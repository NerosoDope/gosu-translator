import base64
import csv
import io
import json
import logging
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.translate import csv_handler, excel_handler, json_handler, word_handler
from app.modules.translate.xml_handler import (
    parse_xml as parse_xml_handler,
    parse_xml_string_to_rows,
    read_full_xml as read_full_xml_handler,
    rebuild_xml_from_rows,
    export_xml as export_xml_handler,
    split_xml_declaration,
    xml_to_string,
    xml_local_tag as xml_local_tag_fn,
)
from app.modules.translate.utils import decode_text
from app.modules.translate.schemas import (
    ExportFileRequest,
    ParseAllRowsResponse,
    ParseFileResponse,
    ParseJsonContentRequest,
    ParseJsonContentResponse,
    ParseXmlContentRequest,
    ParseXmlContentResponse,
    ProofreadBatchRequest,
    ProofreadBatchResponse,
    ProofreadBatchResultItem,
    ProofreadRowRequest,
    ProofreadRowResponse,
    RebuildXmlRequest,
    RebuildXmlResponse,
    TranslateFileResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.modules.translate.service import (
    proofread_with_ai,
    proofread_with_ai_batch,
    save_translation_to_cache,
    translate_check_only,
    translate_with_ai_batch,
    translate_with_priority,
    verify_gemini_api_key,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="", tags=["translate"])

PREVIEW_ROW_LIMIT = 5
TRANSLATE_FILE_MAX_ROWS = 500
# Số segment tối đa gửi trong 1 lần gọi AI batch (fallback nếu không ước tính token)
TRANSLATE_BATCH_SIZE = 30
# Token input tối đa mỗi batch (Gemini flash ~1M context, nhưng ta giới hạn để kiểm soát cost)
TRANSLATE_BATCH_MAX_INPUT_TOKENS = 1500


def _estimate_tokens(text: str) -> int:
    """Ước tính số token: tiếng Việt/Anh ≈ 3 ký tự/token (không cần tiktoken)."""
    return max(1, len(text) // 3)


def _build_token_batches(
    pending: "List[Tuple[int, str, str]]",
    max_tokens: int = TRANSLATE_BATCH_MAX_INPUT_TOKENS,
    max_items: int = TRANSLATE_BATCH_SIZE,
) -> "List[List[Tuple[int, str, str]]]":
    """
    Gom pending cells thành batches dựa trên ước tính token.
    Mỗi item chiếm: _estimate_tokens(text) + 6 (overhead số dòng + dấu chấm).
    """
    batches: List[List[Tuple[int, str, str]]] = []
    current: List[Tuple[int, str, str]] = []
    current_tokens = 0
    for item in pending:
        tok = _estimate_tokens(item[2]) + 6
        if current and (current_tokens + tok > max_tokens or len(current) >= max_items):
            batches.append(current)
            current = [item]
            current_tokens = tok
        else:
            current.append(item)
            current_tokens += tok
    if current:
        batches.append(current)
    return batches


# ─────────────────────────────────────────────────────────────────────────────
# Smart Filter — phân loại 5 nhóm:
#   🟢 Natural language   → dịch
#   🟡 Mixed text         → bóc placeholder rồi dịch phần text
#   🔵 Placeholder only   → không dịch
#   🔴 Code-like          → không dịch
#   ⚫ Pure technical     → không dịch
# ─────────────────────────────────────────────────────────────────────────────

# Nhóm ⚫ Pure technical
_RE_URL         = re.compile(r"^https?://\S+$", re.IGNORECASE)
_RE_EMAIL       = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_RE_ISO_DATE    = re.compile(r"^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$")
_RE_PURE_NUMBER = re.compile(r"^-?\d+([.,]\d+)?([eE][+-]?\d+)?$")
_RE_VERSION     = re.compile(r"^v?\d+\.\d+[\d.\-a-zA-Z]*$")
_RE_ISO_LANG    = re.compile(r"^[a-z]{2,3}$")   # en, vi, fr, zh-CN (chuỗi ngắn toàn chữ thường)
_RE_BOOLEAN     = re.compile(r"^(true|false|null|undefined|none|nan)$", re.IGNORECASE)
_RE_FILE_PATH   = re.compile(
    r"^(/|\.\.?/)[\w.\-/]+"
    r"\.(png|jpg|jpeg|gif|webp|svg|json|js|ts|tsx|jsx|css|html|htm|py|rb|go|java|php|vue|xml|yaml|yml|sh|env|conf|ini)$",
    re.IGNORECASE,
)

# Nhóm 🔴 Code-like
_RE_ALL_CAPS    = re.compile(r"^[A-Z][A-Z0-9_]*$")         # USER_LOGIN_SUCCESS, API, CONFIG_KEY
_RE_SNAKE_CASE  = re.compile(r"^[a-z][a-z0-9]*(_[a-z0-9]+)+$")  # user_id, config_key (bắt buộc có dấu _)
_RE_CAMEL_CASE  = re.compile(r"^[a-z]+([A-Z][a-z0-9]+)+$")       # userId, configKey

# Natural language helpers
_RE_HAS_LETTER  = re.compile(r"[a-zA-ZÀ-ỹ\u00C0-\u024F\u1E00-\u1EFF]")
_RE_NATURAL_START = re.compile(r"^[A-ZÀ-Ỵ\u00C0-\u024F\u1E00-\u1EFF][a-zà-ỹ\u00C0-\u024F\u1E00-\u1EFF]")
_RE_PUNCTUATION = re.compile(r"[.,!?;:]")

# Nhóm 🔵 Placeholder — tất cả dạng biến: {x}, {{x}}, %s, %d, %1$s, ${x}, <x>, @x@
_RE_PLACEHOLDER = re.compile(
    r"("
    r"\{\{[^}]+\}\}"           # {{count}}
    r"|\{[^}]+\}"              # {username}
    r"|\$\{[^}]+\}"            # ${var}
    r"|%\d*\$?[sdifcq%]"       # %s %d %1$s %02d
    r"|%[sdicfqoxXeEgGp%]"     # C-style printf
    r"|@[A-Za-z_][A-Za-z0-9_]*@"  # @name@
    r"|<[A-Za-z_][A-Za-z0-9_]*>"  # <var>
    r")"
)


def _should_translate_string(s: str, smart_filter: bool) -> bool:
    """
    Phân loại chuỗi thành 5 nhóm. Khi smart_filter=True áp dụng toàn bộ rule.
    Khi smart_filter=False chỉ loại bỏ chuỗi rỗng và không có chữ cái.

    Nhóm 🟡 Mixed text (có cả text + placeholder): _extract_placeholders xử lý
    trước khi gọi hàm này — hàm chỉ nhận chuỗi đã thay __PH_n__.
    """
    if not s or not isinstance(s, str):
        return False
    s = s.strip()
    if not s:
        return False

    if not smart_filter:
        # Chế độ tắt smart filter: vẫn bỏ chuỗi hoàn toàn không có chữ cái
        return bool(_RE_HAS_LETTER.search(s)) and len(s) > 1

    # ── BƯỚC 1: Loại bỏ ngay ──────────────────────────────────────────────────

    # ⚫ Chỉ số (kể cả số thập phân, số âm, scientific)
    if _RE_PURE_NUMBER.match(s):
        return False

    # ⚫ Boolean / null
    if _RE_BOOLEAN.match(s):
        return False

    # ⚫ URL
    if _RE_URL.match(s):
        return False

    # ⚫ Email
    if _RE_EMAIL.match(s):
        return False

    # ⚫ File path (bắt đầu bằng / hoặc ./ hoặc ../)
    if _RE_FILE_PATH.match(s):
        return False

    # ⚫ ISO date/datetime
    if _RE_ISO_DATE.match(s):
        return False

    # ⚫ Version string: v1.2.3, 1.0.0-beta
    if _RE_VERSION.match(s):
        return False

    # ⚫ ISO language code: en, vi, fr, zh (2-3 ký tự toàn thường)
    if _RE_ISO_LANG.match(s):
        return False

    # 🔴 ALL_CAPS_CODE: USER_LOGIN_SUCCESS, API_TIMEOUT, CONFIG_KEY, ADMIN
    if _RE_ALL_CAPS.match(s):
        return False

    # 🔴 snake_case_key: user_id, config_key (bắt buộc có ít nhất 1 dấu _)
    if _RE_SNAKE_CASE.match(s):
        return False

    # 🔴 camelCaseKey: userId, configKey
    if _RE_CAMEL_CASE.match(s):
        return False

    # 🔵 Placeholder-only: sau khi bóc hết placeholder không còn gì
    s_no_ph = _RE_PLACEHOLDER.sub("", s).strip()
    if not s_no_ph:
        return False

    # ── BƯỚC 2: Kiểm tra dấu hiệu ngôn ngữ tự nhiên ─────────────────────────
    if not _RE_HAS_LETTER.search(s):
        return False
    if len(s) <= 1:
        return False

    # 🟢 Có khoảng trắng → rất có thể là câu/cụm từ tự nhiên
    if " " in s:
        return True

    # 🟢 Bắt đầu hoa + chữ thường (kể cả Unicode/tiếng Việt)
    if _RE_NATURAL_START.match(s):
        return True

    # 🟢 Có dấu câu
    if _RE_PUNCTUATION.search(s):
        return True

    # 🟢 Dài > 3 ký tự và có chữ cái (final fallback)
    if len(s) > 3 and _RE_HAS_LETTER.search(s):
        return True

    return False


def _extract_placeholders(s: str) -> Tuple[str, List[str]]:
    """
    Bóc placeholder khỏi chuỗi, thay bằng __PH_n__.
    Trả về (chuỗi đã thay, danh sách placeholder gốc theo thứ tự).
    Hỗ trợ: {x}, {{x}}, ${x}, %s/%d/%1$s, @name@, <var>.
    """
    if not s:
        return s, []
    placeholders: List[str] = []

    def repl(m: re.Match) -> str:
        placeholders.append(m.group(0))
        return f"__PH_{len(placeholders) - 1}__"

    out = _RE_PLACEHOLDER.sub(repl, s)
    return out, placeholders


def _restore_placeholders(s: str, placeholders: List[str]) -> str:
    """Khôi phục __PH_n__ về placeholder gốc sau khi AI dịch xong."""
    if not placeholders:
        return s
    for i, ph in enumerate(placeholders):
        s = s.replace(f"__PH_{i}__", ph)
    return s


async def _translate_json_recursive(
    obj: Any,
    db: AsyncSession,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int],
    context: Optional[str],
    style: Optional[str],
    smart_filter: bool,
    translate_keys: bool,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
) -> Any:
    """
    Duyệt đệ quy JSON: chỉ dịch value là string (và optionally key).
    Giữ nguyên: key (nếu không bật translate_keys), số, boolean, null, cấu trúc.
    """
    if obj is None:
        return None
    if isinstance(obj, bool):
        return obj
    if isinstance(obj, (int, float)):
        return obj
    if isinstance(obj, str):
        if _should_translate_string(obj, smart_filter):
            try:
                return await translate_with_priority(
                    db,
                    text=obj,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    prompt_id=prompt_id,
                    context=context,
                    style=style,
                    game_id=game_id,
                    game_category_id=game_category_id,
                ) or obj
            except Exception as e:
                logger.warning("Translate JSON string: %s", e)
                return obj
        return obj
    if isinstance(obj, list):
        return [
            await _translate_json_recursive(
                item, db, source_lang, target_lang,
                prompt_id, context, style, smart_filter, translate_keys,
                game_id=game_id, game_category_id=game_category_id,
            )
            for item in obj
        ]
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            key = k
            if translate_keys and isinstance(k, str) and _should_translate_string(k, smart_filter):
                try:
                    key = await translate_with_priority(
                        db, text=k, source_lang=source_lang, target_lang=target_lang,
                        prompt_id=prompt_id, context=context, style=style,
                        game_id=game_id, game_category_id=game_category_id,
                    ) or k
                except Exception:
                    pass
            out[key] = await _translate_json_recursive(
                v, db, source_lang, target_lang,
                prompt_id, context, style, smart_filter, translate_keys,
                game_id=game_id, game_category_id=game_category_id,
            )
        return out
    return obj


# --- Dịch XML giữ cấu trúc: chỉ text trong thẻ, không dịch attribute/tên thẻ, giữ placeholder ---
XML_UI_TAGS = frozenset({"string", "text", "description", "title", "message", "label", "subtitle", "content"})

# Các thẻ Android Resource chứa <item> con có text cần dịch (plurals, string-array, string).
# Khi parent là một trong các thẻ này, <item> con sẽ được force-translatable.
ANDROID_ITEM_PARENTS = frozenset({"plurals", "string-array", "string"})


def _is_xml_translatable(el: ET.Element, respect_translatable: bool, force: bool = False) -> bool:
    """Chỉ dịch thẻ UI (string, text, ...) hoặc có translatable=\"true\"; bỏ qua translatable=\"false\".
    Nếu force=True (parent là Android container), luôn dịch trừ khi có translatable=\"false\".
    """
    if respect_translatable:
        trans = (el.attrib.get("translatable") or "").strip().lower()
        if trans == "false":
            return False
        if trans == "true":
            return True
    if force:
        return True
    tag = xml_local_tag_fn(el)
    return tag.lower() in XML_UI_TAGS


# Ref để gán lại kết quả dịch XML: (element, 'text'|'tail')
_XmlRef = Tuple[ET.Element, str]


def _collect_xml_segments(
    el: ET.Element,
    preserve_placeholders: bool,
    respect_translatable: bool,
    smart_filter: bool,
    _force_children: bool = False,
) -> "List[Tuple[_XmlRef, str, List[str]]]":
    """
    Thu thập tất cả đoạn text cần dịch trong cây XML.
    Trả về list (ref, text_đã_bóc_placeholder, placeholders) để gom batch.
    """
    out: List[Tuple[_XmlRef, str, List[str]]] = []
    if el is None:
        return out
    translatable = _is_xml_translatable(el, respect_translatable, force=_force_children)

    def add(t: str, ref: _XmlRef) -> None:
        if not t or not t.strip():
            return
        orig = t
        if preserve_placeholders:
            t, phs = _extract_placeholders(t)
        else:
            phs = []
        if not _should_translate_string(t, smart_filter):
            return
        out.append((ref, t.strip(), phs))

    if translatable and el.text and el.text.strip():
        add(el.text, (el, "text"))

    current_tag = xml_local_tag_fn(el).lower()
    force_for_children = current_tag in ANDROID_ITEM_PARENTS

    for child in el:
        out.extend(
            _collect_xml_segments(
                child,
                preserve_placeholders=preserve_placeholders,
                respect_translatable=respect_translatable,
                smart_filter=smart_filter,
                _force_children=force_for_children,
            )
        )
        if translatable and child.tail and child.tail.strip():
            add(child.tail, (child, "tail"))
    return out


def _build_xml_batches(
    pending: "List[Tuple[_XmlRef, str, List[str]]]",
    max_tokens: int = TRANSLATE_BATCH_MAX_INPUT_TOKENS,
    max_items: int = TRANSLATE_BATCH_SIZE,
) -> "List[List[Tuple[_XmlRef, str, List[str]]]]":
    """Gom danh sách (ref, text, placeholders) thành các batch theo token."""
    batches: List[List[Tuple[_XmlRef, str, List[str]]]] = []
    current: List[Tuple[_XmlRef, str, List[str]]] = []
    current_tokens = 0
    for item in pending:
        ref, text, phs = item
        tok = _estimate_tokens(text) + 6
        if current and (current_tokens + tok > max_tokens or len(current) >= max_items):
            batches.append(current)
            current = [item]
            current_tokens = tok
        else:
            current.append(item)
            current_tokens += tok
    if current:
        batches.append(current)
    return batches


async def _translate_xml_recursive(
    el: ET.Element,
    db: AsyncSession,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int],
    context: Optional[str],
    style: Optional[str],
    preserve_placeholders: bool,
    respect_translatable: bool,
    smart_filter: bool,
    _force_children: bool = False,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
) -> None:
    """
    Duyệt cây XML, chỉ dịch text bên trong thẻ (el.text, child.tail). Không dịch attribute, tên thẻ.
    Giữ placeholder {x}, %d, %s, {{count}}. Chỉ dịch thẻ UI hoặc translatable=\"true\".
    _force_children=True khi parent là Android container (plurals, string-array) — buộc dịch <item>.
    Sửa tại chỗ (in-place).
    GOM BATCH: thu thập segment → tra cache/glossary → gọi AI theo batch → gán lại.
    """
    if el is None:
        return
    segments = _collect_xml_segments(
        el,
        preserve_placeholders=preserve_placeholders,
        respect_translatable=respect_translatable,
        smart_filter=smart_filter,
        _force_children=_force_children,
    )
    if not segments:
        return

    # Dedupe: tra Cache + Glossary (thứ tự ưu tiên) mỗi text chỉ 1 lần
    cache_by_text: Dict[str, Optional[str]] = {}
    for ref, text, phs in segments:
        if text not in cache_by_text:
            cache_by_text[text] = None
    for text in cache_by_text:
        try:
            hit = await translate_check_only(
                db, text, source_lang, target_lang,
                game_id=game_id, game_category_id=game_category_id,
            )
            cache_by_text[text] = hit
        except Exception as e:
            logger.warning("XML translate_check_only text=%s: %s", text[:40], e)
            cache_by_text[text] = None

    pending: List[Tuple[_XmlRef, str, List[str]]] = []
    for ref, text, phs in segments:
        hit = cache_by_text.get(text)
        if hit is not None:
            if preserve_placeholders and phs:
                hit = _restore_placeholders(hit, phs)
            elem, kind = ref
            if kind == "text":
                elem.text = hit
            else:
                elem.tail = hit
        else:
            pending.append((ref, text, phs))

    if not pending:
        return

    batches = _build_xml_batches(pending)
    for batch in batches:
        texts_to_translate = [t for _, t, _ in batch]
        try:
            results = await translate_with_ai_batch(
                db,
                texts=texts_to_translate,
                source_lang=source_lang,
                target_lang=target_lang,
                prompt_id=prompt_id,
                context=context,
                style=style,
                game_id=game_id,
                game_category_id=game_category_id,
            )
        except Exception as e:
            logger.warning("translate_xml batch: %s", e)
            results = texts_to_translate
        for (ref, orig_text, phs), translated in zip(batch, results):
            if not translated:
                translated = orig_text
            if preserve_placeholders and phs:
                translated = _restore_placeholders(translated, phs)
            if translated != orig_text and translated.strip():
                await save_translation_to_cache(
                    db, orig_text, translated, source_lang, target_lang, origin="file"
                )
            elem, kind = ref
            if kind == "text":
                elem.text = translated
            else:
                elem.tail = translated


@router.post("/parse-file", response_model=ParseFileResponse)
async def parse_file(file: UploadFile = File(...)):
    """
    Đọc file Excel/CSV/JSON/XML/DOCX, trả về danh sách cột và vài dòng xem trước.
    Dùng cho bước "Chọn cột" trên trang Dịch file.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không có file.")
    name = (file.filename or "").lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File rỗng.")
    if name.endswith(".xlsx"):
        return await excel_handler.parse_excel(content, preview_limit=PREVIEW_ROW_LIMIT)
    if name.endswith(".csv"):
        return await csv_handler.parse_csv(content, preview_limit=PREVIEW_ROW_LIMIT)
    if name.endswith(".json"):
        return await json_handler.parse_json(content, preview_limit=PREVIEW_ROW_LIMIT)
    if name.endswith(".xml"):
        return await parse_xml_handler(content, preview_limit=PREVIEW_ROW_LIMIT)
    if name.endswith(".docx"):
        return await word_handler.parse_docx(content, preview_limit=PREVIEW_ROW_LIMIT)
    raise HTTPException(
        status_code=400,
        detail="Chỉ hỗ trợ file .xlsx, .csv, .json, .xml, .docx.",
    )


@router.post("/translate-file", response_model=TranslateFileResponse)
async def translate_file(
    file: UploadFile = File(...),
    selected_columns: str = Form(..., description="JSON array of column names to translate"),
    source_lang: str = Form(...),
    target_lang: str = Form(...),
    prompt_id: str = Form(""),
    context: str = Form(""),
    style: str = Form(""),
    game_id: str = Form(""),
    game_category_id: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Đọc file Excel/CSV, dịch các cột đã chọn theo từng ô (Cache -> Từ điển -> AI).
    Trả về toàn bộ dòng với cột gốc + cột _translated cho mỗi cột được chọn.
    Giới hạn tối đa TRANSLATE_FILE_MAX_ROWS dòng.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không có file.")
    name = (file.filename or "").lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File rỗng.")
    if not any(name.endswith(ext) for ext in (".xlsx", ".csv", ".json", ".xml", ".docx")):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file .xlsx, .csv, .json, .xml, .docx.")

    try:
        cols_list = json.loads(selected_columns)
        if not isinstance(cols_list, list):
            cols_list = []
    except (json.JSONDecodeError, TypeError):
        cols_list = []
    selected_set = {str(c).strip() for c in cols_list if c}

    source_lang = (source_lang or "").strip()
    target_lang = (target_lang or "").strip()
    if not source_lang or not target_lang:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích.")
    if source_lang == target_lang:
        raise HTTPException(status_code=400, detail="Ngôn ngữ nguồn và đích phải khác nhau.")

    prompt_id_int = None
    if (prompt_id or "").strip():
        try:
            prompt_id_int = int(prompt_id.strip())
        except ValueError:
            pass
    game_id_int = None
    if (game_id or "").strip():
        try:
            game_id_int = int(game_id.strip())
        except ValueError:
            pass
    game_category_id_int = None
    if (game_category_id or "").strip():
        try:
            game_category_id_int = int(game_category_id.strip())
        except ValueError:
            pass
    context = (context or "").strip() or None
    style = (style or "").strip() or None

    if name.endswith(".xlsx"):
        columns, rows = excel_handler.read_full_excel(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".csv"):
        columns, rows = csv_handler.read_full_csv(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".json"):
        columns, rows = json_handler.read_full_json(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".xml"):
        columns, rows = read_full_xml_handler(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".docx"):
        columns, rows = word_handler.read_full_docx(content, TRANSLATE_FILE_MAX_ROWS)
    else:
        columns, rows = [], []

    to_translate = [c for c in selected_set if c in columns]
    if not to_translate:
        # Trả 200 với dữ liệu rỗng thay vì 400 (tránh lỗi "Failed to load resource" khi JSON/XML parse lỗi)
        fallback_cols = list(selected_set) if selected_set else (columns or ["Nội dung"])
        return TranslateFileResponse(columns=fallback_cols, rows=[])

    # ── Pass 1: tra Cache + Glossary (thứ tự ưu tiên), dedupe theo text để giảm gọi DB ──
    seen_texts: Dict[str, Optional[str]] = {}
    cell_tasks: List[Tuple[int, str, str]] = []
    for row_idx, row in enumerate(rows):
        for col in to_translate:
            text = (row.get(col) or "").strip()
            if not text:
                row[col + "_translated"] = ""
                continue
            cell_tasks.append((row_idx, col, text))
            if text not in seen_texts:
                seen_texts[text] = None
    unique_texts = list(seen_texts.keys())
    for text in unique_texts:
        try:
            hit = await translate_check_only(
                db, text, source_lang, target_lang,
                game_id=game_id_int, game_category_id=game_category_id_int,
            )
            seen_texts[text] = hit
        except Exception as e:
            logger.warning("translate_check_only text=%s: %s", text[:40], e)
            try:
                await db.rollback()
            except Exception:
                pass
            seen_texts[text] = None
    pending: List[Tuple[int, str, str]] = []
    for row_idx, col, text in cell_tasks:
        hit = seen_texts.get(text)
        if hit is not None:
            rows[row_idx][col + "_translated"] = hit
        else:
            rows[row_idx][col + "_translated"] = None
            pending.append((row_idx, col, text))

    # ── Pass 2: gom batch theo token → gọi AI 1 lần / batch → lưu cache ──
    token_batches = _build_token_batches(pending)
    for batch in token_batches:
        texts_to_translate = [t for _, _, t in batch]
        try:
            results = await translate_with_ai_batch(
                db,
                texts=texts_to_translate,
                source_lang=source_lang,
                target_lang=target_lang,
                prompt_id=prompt_id_int,
                context=context,
                style=style,
                game_id=game_id_int,
                game_category_id=game_category_id_int,
            )
        except Exception as e:
            logger.warning("translate_with_ai_batch: %s", e)
            results = [t for _, _, t in batch]
        saved_count = 0
        for (row_idx, col, orig_text), translated in zip(batch, results):
            rows[row_idx][col + "_translated"] = translated or orig_text
            if translated and translated != orig_text:
                await save_translation_to_cache(db, orig_text, translated, source_lang, target_lang, origin="file")
                saved_count += 1
            logger.info("translate_file batch: %d results, %d cached", len(batch), saved_count)

    output_columns = columns + [c + "_translated" for c in to_translate]
    translated_json = None
    translated_docx_b64 = None
    if name.endswith(".json"):
        translated_json = json_handler.reconstruct_translated_json(content, rows, to_translate)
    elif name.endswith(".docx"):
        try:
            docx_bytes = word_handler.build_translated_docx(content, columns, rows, to_translate)
            translated_docx_b64 = base64.b64encode(docx_bytes).decode("ascii")
        except Exception as e:
            logger.warning("Build translated DOCX: %s", e)
    return TranslateFileResponse(
        columns=output_columns,
        rows=rows,
        translated_json=translated_json,
        translated_docx_b64=translated_docx_b64,
    )


@router.post("/translate-file-stream")
async def translate_file_stream(
    file: UploadFile = File(...),
    selected_columns: str = Form(..., description="JSON array of column names to translate"),
    source_lang: str = Form(...),
    target_lang: str = Form(...),
    prompt_id: str = Form(""),
    context: str = Form(""),
    style: str = Form(""),
    game_id: str = Form(""),
    game_category_id: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Dịch file với Server-Sent Events (SSE) để hiển thị tiến trình real-time.
    Trả về stream text/event-stream với các event: start, progress, done, error.
    """
    from fastapi.responses import StreamingResponse as _SR

    if not file.filename:
        raise HTTPException(status_code=400, detail="Không có file.")
    name = (file.filename or "").lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File rỗng.")
    if not any(name.endswith(ext) for ext in (".xlsx", ".csv", ".json", ".xml", ".docx")):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file .xlsx, .csv, .json, .xml, .docx.")

    try:
        cols_list = json.loads(selected_columns)
        if not isinstance(cols_list, list):
            cols_list = []
    except (json.JSONDecodeError, TypeError):
        cols_list = []
    selected_set = {str(c).strip() for c in cols_list if c}
    source_lang = (source_lang or "").strip()
    target_lang = (target_lang or "").strip()
    if not source_lang or not target_lang:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích.")
    if source_lang == target_lang:
        raise HTTPException(status_code=400, detail="Ngôn ngữ nguồn và đích phải khác nhau.")

    prompt_id_int: Optional[int] = None
    if (prompt_id or "").strip():
        try:
            prompt_id_int = int(prompt_id.strip())
        except ValueError:
            pass
    game_id_int: Optional[int] = None
    if (game_id or "").strip():
        try:
            game_id_int = int(game_id.strip())
        except ValueError:
            pass
    game_category_id_int: Optional[int] = None
    if (game_category_id or "").strip():
        try:
            game_category_id_int = int(game_category_id.strip())
        except ValueError:
            pass
    ctx = (context or "").strip() or None
    sty = (style or "").strip() or None

    # Đọc file
    if name.endswith(".xlsx"):
        columns, rows = excel_handler.read_full_excel(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".csv"):
        columns, rows = csv_handler.read_full_csv(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".json"):
        columns, rows = json_handler.read_full_json(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".xml"):
        columns, rows = read_full_xml_handler(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".docx"):
        columns, rows = word_handler.read_full_docx(content, TRANSLATE_FILE_MAX_ROWS)
    else:
        columns, rows = [], []

    to_translate = [c for c in selected_set if c in columns]

    async def generate():
        def _sse(obj: dict) -> str:
            return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"

        if not to_translate:
            yield _sse({"type": "done", "columns": list(selected_set) or columns or ["Nội dung"], "rows": [], "translated_json": None, "translated_docx_b64": None})
            return

        # ── Pass 1: Cache + Glossary (thứ tự ưu tiên). Dedupe theo text để giảm số lần gọi DB. ──
        unique_texts: List[str] = []
        seen_texts: Dict[str, Optional[str]] = {}
        cell_tasks: List[Tuple[int, str, str]] = []  # (row_idx, col, text)
        for row_idx, row in enumerate(rows):
            for col in to_translate:
                text = (row.get(col) or "").strip()
                if not text:
                    row[col + "_translated"] = ""
                    continue
                cell_tasks.append((row_idx, col, text))
                if text not in seen_texts:
                    seen_texts[text] = None
                    unique_texts.append(text)
        for text in unique_texts:
            try:
                hit = await translate_check_only(
                    db, text, source_lang, target_lang,
                    game_id=game_id_int, game_category_id=game_category_id_int,
                )
                seen_texts[text] = hit
            except Exception as e:
                logger.warning("SSE translate_check_only text=%s: %s", text[:40], e)
                try:
                    await db.rollback()
                except Exception:
                    pass
                seen_texts[text] = None
        pending: List[Tuple[int, str, str]] = []
        for row_idx, col, text in cell_tasks:
            hit = seen_texts.get(text)
            if hit is not None:
                rows[row_idx][col + "_translated"] = hit
            else:
                rows[row_idx][col + "_translated"] = None
                pending.append((row_idx, col, text))
        logger.info("SSE Pass 1: %d unique texts, %d cache/glossary hits, %d pending", len(unique_texts), len(cell_tasks) - len(pending), len(pending))

        total_cells = len(pending)
        token_batches = _build_token_batches(pending)
        batch_total = len(token_batches)

        yield _sse({"type": "start", "total": total_cells, "batch_total": batch_total})

        logger.info("SSE file translate: %d pending cells, %d batches", total_cells, batch_total)
        cells_done = 0
        for batch_idx, batch in enumerate(token_batches):
            texts_to_translate = [t for _, _, t in batch]
            logger.info("SSE batch %s input (first 3): %s", batch_idx, texts_to_translate[:3])
            try:
                results = await translate_with_ai_batch(
                    db,
                    texts=texts_to_translate,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    prompt_id=prompt_id_int,
                    context=ctx,
                    style=sty,
                    game_id=game_id_int,
                    game_category_id=game_category_id_int,
                )
                logger.info("SSE batch %s output (first 3): %s", batch_idx, results[:3])
            except Exception as e:
                logger.warning("SSE translate batch %s FAILED: %s", batch_idx, e, exc_info=True)
                results = [t for _, _, t in batch]

            saved_count = 0
            for (row_idx, col, orig_text), translated in zip(batch, results):
                rows[row_idx][col + "_translated"] = translated or orig_text
                if translated and translated != orig_text:
                    await save_translation_to_cache(db, orig_text, translated, source_lang, target_lang, origin="file")
                    saved_count += 1
            logger.info("SSE batch %s: %d results, %d cached", batch_idx, len(batch), saved_count)

            cells_done += len(batch)
            percent = round(cells_done * 100 / total_cells) if total_cells else 100
            yield _sse({
                "type": "progress",
                "done": cells_done,
                "total": total_cells,
                "batch_done": batch_idx + 1,
                "batch_total": batch_total,
                "percent": percent,
                "batch_size": len(batch),
                "batch_tokens": sum(_estimate_tokens(t) for _, _, t in batch),
            })

        # Xây dựng kết quả cuối
        output_columns = columns + [c + "_translated" for c in to_translate]
        translated_json = None
        translated_docx_b64 = None
        if name.endswith(".json"):
            translated_json = json_handler.reconstruct_translated_json(content, rows, to_translate)
        elif name.endswith(".docx"):
            try:
                docx_bytes = word_handler.build_translated_docx(content, columns, rows, to_translate)
                translated_docx_b64 = base64.b64encode(docx_bytes).decode("ascii")
            except Exception as e:
                logger.warning("SSE build DOCX: %s", e)

        yield _sse({
            "type": "done",
            "columns": output_columns,
            "rows": rows,
            "translated_json": translated_json,
            "translated_docx_b64": translated_docx_b64,
        })

    return _SR(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.post("/translate-json-file")
async def translate_json_file(
    file: UploadFile = File(...),
    source_lang: str = Form(...),
    target_lang: str = Form(...),
    smart_filter: str = Form("true"),
    translate_keys: str = Form("false"),
    prompt_id: str = Form(""),
    context: str = Form(""),
    style: str = Form(""),
    game_id: str = Form(""),
    game_category_id: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Dịch file JSON giữ nguyên cấu trúc: chỉ dịch value là chuỗi (Cache → Từ điển → AI).
    Không đụng key, số, boolean, null, cấu trúc. Smart Filter: bỏ qua URL, email, số, ngày ISO, enum.
    Trả về JSON (application/json), frontend có thể lưu thành file.
    """
    if not file.filename or not (file.filename or "").lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .json.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File rỗng.")
    text = decode_text(content)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="File không phải JSON hợp lệ. Vui lòng kiểm tra cú pháp.")
    source_lang = (source_lang or "").strip()
    target_lang = (target_lang or "").strip()
    if not source_lang or not target_lang:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích.")
    if source_lang == target_lang:
        raise HTTPException(status_code=400, detail="Ngôn ngữ nguồn và đích phải khác nhau.")
    use_smart_filter = (smart_filter or "").strip().lower() in ("true", "1", "yes")
    use_translate_keys = (translate_keys or "").strip().lower() in ("true", "1", "yes")
    prompt_id_int = None
    if (prompt_id or "").strip():
        try:
            prompt_id_int = int(prompt_id.strip())
        except ValueError:
            pass
    game_id_int = None
    if (game_id or "").strip():
        try:
            game_id_int = int(game_id.strip())
        except ValueError:
            pass
    game_category_id_int = None
    if (game_category_id or "").strip():
        try:
            game_category_id_int = int(game_category_id.strip())
        except ValueError:
            pass
    context = (context or "").strip() or None
    style = (style or "").strip() or None

    try:
        result = await _translate_json_recursive(
            data,
            db,
            source_lang,
            target_lang,
            prompt_id_int,
            context,
            style,
            smart_filter=use_smart_filter,
            translate_keys=use_translate_keys,
            game_id=game_id_int,
            game_category_id=game_category_id_int,
        )
        body = json.dumps(result, ensure_ascii=False, indent=2, default=str)
    except ValueError as e:
        logger.warning("translate_json_file ValueError: %s", e)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("translate_json_file error: %s", e)
        raise HTTPException(
            status_code=500,
            detail=getattr(e, "message", str(e)) or "Lỗi khi dịch file JSON. Vui lòng thử lại hoặc kiểm tra Cài đặt (Gemini API Key).",
        )

    filename = (file.filename or "translated").replace(".json", "") + "_translated.json"
    return Response(
        content=body.encode("utf-8"),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/translate-xml-file")
async def translate_xml_file(
    file: UploadFile = File(...),
    source_lang: str = Form(...),
    target_lang: str = Form(...),
    preserve_placeholders: str = Form("true"),
    respect_translatable: str = Form("true"),
    smart_filter: str = Form("true"),
    prompt_id: str = Form(""),
    context: str = Form(""),
    style: str = Form(""),
    game_id: str = Form(""),
    game_category_id: str = Form(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Dịch file XML giữ cấu trúc: chỉ dịch text bên trong thẻ (string, text, description, title...).
    Không dịch attribute, tên thẻ. Giữ placeholder {username}, %d, %s, {{count}}.
    Chỉ dịch thẻ translatable="true" hoặc thẻ UI; bỏ qua translatable="false".
    """
    if not file.filename or not (file.filename or "").lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .xml.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File rỗng.")
    text = decode_text(content)
    decl, rest = split_xml_declaration(text)
    if not rest.strip():
        raise HTTPException(status_code=400, detail="File XML không có nội dung.")
    try:
        root = ET.fromstring(rest)
    except ET.ParseError as e:
        raise HTTPException(status_code=400, detail=f"File không phải XML hợp lệ: {str(e)[:150]}")
    source_lang = (source_lang or "").strip()
    target_lang = (target_lang or "").strip()
    if not source_lang or not target_lang:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích.")
    if source_lang == target_lang:
        raise HTTPException(status_code=400, detail="Ngôn ngữ nguồn và đích phải khác nhau.")
    use_preserve_placeholders = (preserve_placeholders or "").strip().lower() in ("true", "1", "yes")
    use_respect_translatable = (respect_translatable or "").strip().lower() in ("true", "1", "yes")
    use_smart_filter = (smart_filter or "").strip().lower() in ("true", "1", "yes")
    prompt_id_int = None
    if (prompt_id or "").strip():
        try:
            prompt_id_int = int(prompt_id.strip())
        except ValueError:
            pass
    game_id_int = None
    if (game_id or "").strip():
        try:
            game_id_int = int(game_id.strip())
        except ValueError:
            pass
    game_category_id_int = None
    if (game_category_id or "").strip():
        try:
            game_category_id_int = int(game_category_id.strip())
        except ValueError:
            pass
    context = (context or "").strip() or None
    style = (style or "").strip() or None

    await _translate_xml_recursive(
        root,
        db,
        source_lang,
        target_lang,
        prompt_id_int,
        context,
        style,
        preserve_placeholders=use_preserve_placeholders,
        respect_translatable=use_respect_translatable,
        smart_filter=use_smart_filter,
        game_id=game_id_int,
        game_category_id=game_category_id_int,
    )
    out_body = (xml_to_string(root, declaration=decl) if decl else xml_to_string(root))
    filename = (file.filename or "translated").replace(".xml", "") + "_translated.xml"
    return Response(
        content=out_body.encode("utf-8"),
        media_type="application/xml; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/parse-xml-content", response_model=ParseXmlContentResponse)
async def parse_xml_content(body: ParseXmlContentRequest):
    """
    Parse chuỗi XML (nội dung đã dịch) thành columns + rows để hiển thị hiệu đính.
    Trả về root_tag, row_tag, root_attribs, declaration để rebuild sau khi sửa.
    """
    columns, rows, root_tag, row_tag, root_attribs, declaration = parse_xml_string_to_rows(body.content or "")
    return ParseXmlContentResponse(
        columns=columns,
        rows=rows,
        root_tag=root_tag,
        row_tag=row_tag,
        root_attribs=root_attribs,
        declaration=declaration,
    )


@router.post("/rebuild-xml-from-rows", response_model=RebuildXmlResponse)
async def rebuild_xml_from_rows_api(body: RebuildXmlRequest):
    """Dựng lại chuỗi XML từ rows sau khi hiệu đính."""
    content = rebuild_xml_from_rows(
        root_tag=body.root_tag,
        row_tag=body.row_tag,
        root_attribs=body.root_attribs or {},
        columns=body.columns,
        rows=body.rows,
        declaration=body.declaration or "",
    )
    return RebuildXmlResponse(content=content)


# Giới hạn dòng khi parse JSON từ chuỗi (xem trước / hiệu đính)
PARSE_JSON_CONTENT_MAX_ROWS = 50_000


@router.post("/parse-json-content", response_model=ParseJsonContentResponse)
async def parse_json_content(body: ParseJsonContentRequest):
    """
    Parse chuỗi JSON thành columns + rows (toàn bộ, không giới hạn 5 dòng).
    Dùng cho bước 5: xem trước nội dung cũ/đã dịch và hiệu đính.
    """
    content = (body.content or "").strip()
    if not content:
        return ParseJsonContentResponse(columns=["Nội dung"], rows=[])
    raw = content.encode("utf-8")
    columns, rows = json_handler.read_full_json(raw, PARSE_JSON_CONTENT_MAX_ROWS)
    if not columns:
        columns = ["Nội dung"]
    # Đảm bảo mỗi row là Dict[str, str] cho response
    str_rows = [{k: (str(v) if v is not None else "") for k, v in row.items()} for row in rows]
    return ParseJsonContentResponse(columns=columns, rows=str_rows)


@router.post("/parse-file-full", response_model=ParseAllRowsResponse)
async def parse_file_full(file: UploadFile = File(...)):
    """
    Parse toàn bộ dòng từ file .xlsx hoặc .csv (không giới hạn 5 dòng preview).
    Dùng cho tính năng Hiệu Đính File - cần đọc tất cả dòng để chỉnh sửa/hiệu đính.
    Giới hạn tối đa TRANSLATE_FILE_MAX_ROWS dòng.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Không có file.")
    filename_lower = (file.filename or "").lower()
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File rỗng.")

    if filename_lower.endswith(".xlsx") or filename_lower.endswith(".xls"):
        columns, rows = excel_handler.read_full_excel(content, TRANSLATE_FILE_MAX_ROWS)
        return ParseAllRowsResponse(columns=columns, rows=rows, total=len(rows))
    elif filename_lower.endswith(".csv"):
        columns, rows = csv_handler.read_full_csv(content, TRANSLATE_FILE_MAX_ROWS)
        return ParseAllRowsResponse(columns=columns, rows=rows, total=len(rows))
    else:
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .xlsx hoặc .csv cho Hiệu Đính File.")


@router.post("/proofread-row", response_model=ProofreadRowResponse)
async def proofread_row_endpoint(
    body: ProofreadRowRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Hiệu đính 1 dòng bằng AI: nhận văn bản gốc + bản dịch hiện tại, trả về bản dịch đã cải thiện.
    """
    if not body.original.strip():
        raise HTTPException(status_code=400, detail="Văn bản gốc không được để trống.")
    if not body.source_lang.strip() or not body.target_lang.strip():
        raise HTTPException(status_code=400, detail="Vui lòng chọn ngôn ngữ nguồn và đích.")
    try:
        result = await proofread_with_ai(
            db,
            original=body.original.strip(),
            translated=(body.translated or "").strip(),
            source_lang=body.source_lang.strip(),
            target_lang=body.target_lang.strip(),
            prompt_id=body.prompt_id,
            context=body.context or None,
            style=body.style or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hiệu đính AI thất bại: {getattr(e, 'message', str(e))}")
    # Chỉ ghi cache khi hiệu đính ra nội dung khác với bản cũ; không đổi thì không ghi đè nguồn
    current_translated = (body.translated or "").strip()
    if result and (result.strip() != current_translated):
        try:
            await save_translation_to_cache(
                db, body.original.strip(), result,
                body.source_lang.strip(), body.target_lang.strip(),
                origin="proofread",
            )
        except Exception:
            pass
    return ProofreadRowResponse(proofread=result)


@router.post("/proofread-batch", response_model=ProofreadBatchResponse)
async def proofread_batch_endpoint(
    body: ProofreadBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Hiệu đính nhiều dòng cùng lúc (batch AI). Mỗi item gồm index, original, translated.
    Trả về danh sách kết quả [{index, proofread}].
    """
    if not body.items:
        raise HTTPException(status_code=400, detail="Danh sách dòng không được rỗng.")
    if not body.source_lang.strip() or not body.target_lang.strip():
        raise HTTPException(status_code=400, detail="Vui lòng chọn ngôn ngữ nguồn và đích.")
    items_dicts = [
        {"index": item.index, "original": item.original, "translated": item.translated}
        for item in body.items
    ]
    try:
        results = await proofread_with_ai_batch(
            db,
            items=items_dicts,
            source_lang=body.source_lang.strip(),
            target_lang=body.target_lang.strip(),
            prompt_id=body.prompt_id,
            context=body.context or None,
            style=body.style or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hiệu đính batch AI thất bại: {getattr(e, 'message', str(e))}")
    items_by_index = {item["index"]: item for item in items_dicts}
    for r in results:
        orig_item = items_by_index.get(r["index"])
        if not orig_item or not r.get("proofread"):
            continue
        # Chỉ ghi cache khi hiệu đính ra nội dung khác với bản cũ; không đổi thì không ghi đè nguồn
        old_translated = (orig_item.get("translated") or "").strip()
        new_proofread = (r["proofread"] or "").strip()
        if new_proofread != old_translated:
            try:
                await save_translation_to_cache(
                    db, (orig_item.get("original") or "").strip(), new_proofread,
                    body.source_lang.strip(), body.target_lang.strip(),
                    origin="proofread",
                )
            except Exception:
                pass
    return ProofreadBatchResponse(
        results=[ProofreadBatchResultItem(index=r["index"], proofread=r["proofread"]) for r in results]
    )


@router.post("/export-file")
async def export_file(body: ExportFileRequest):
    """
    Xuất dữ liệu đã dịch (columns + rows) ra file theo định dạng: csv, xlsx, json, xml, docx.
    Frontend gọi với format trùng đuôi file đã upload để tải về đúng định dạng.
    """
    fmt = (body.format or "").lower().strip()
    if fmt not in ("csv", "xlsx", "json", "xml", "docx"):
        raise HTTPException(status_code=400, detail="format phải là một trong: csv, xlsx, json, xml, docx.")
    columns = body.columns or []
    rows = body.rows or []
    if not columns:
        raise HTTPException(status_code=400, detail="columns không được rỗng.")
    if fmt == "csv":
        content = csv_handler.export_csv(columns, rows)
        media_type = "text/csv; charset=utf-8"
    elif fmt == "xlsx":
        content = excel_handler.export_xlsx(columns, rows)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif fmt == "json":
        content = json_handler.export_json(columns, rows)
        media_type = "application/json; charset=utf-8"
    elif fmt == "xml":
        content = export_xml_handler(columns, rows)
        media_type = "application/xml; charset=utf-8"
    else:
        content = word_handler.export_docx(columns, rows)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    base = (body.filename or "dich").strip() or "dich"
    filename = f"{base}_translated.{fmt}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/verify")
async def verify_api_key(db: AsyncSession = Depends(get_db)):
    """
    Kiểm tra Gemini API key có hoạt động hay không (đọc từ Cài đặt).
    Luôn trả 200 với { "ok": true/false, "message": "..." } để client không bị "Failed to load resource".
    """
    ok, message = await verify_gemini_api_key(db)
    return {"ok": ok, "message": message}


@router.get("/test-batch-cache")
async def test_batch_cache(
    source_lang: str = Query("vi", description="Ngôn ngữ nguồn"),
    target_lang: str = Query("en", description="Ngôn ngữ đích"),
    db: AsyncSession = Depends(get_db),
):
    """
    Test end-to-end: batch translate 2 dòng test + save to cache.
    Kiểm tra xem AI batch và cache saving có hoạt động không.
    """
    test_texts = ["Xin chào", "Cảm ơn"]
    result: dict = {
        "input": test_texts,
        "translated": [],
        "cached_count": 0,
        "ai_error": None,
        "cache_error": None,
    }
    try:
        from app.modules.translate.service import translate_with_ai_batch, save_translation_to_cache
        translated = await translate_with_ai_batch(
            db,
            texts=test_texts,
            source_lang=source_lang,
            target_lang=target_lang,
        )
        result["translated"] = translated
    except Exception as e:
        result["ai_error"] = str(e)
        return result

    for orig, trans in zip(test_texts, translated):
        if trans and trans != orig:
            try:
                await save_translation_to_cache(db, orig, trans, source_lang, target_lang, origin="direct")
                result["cached_count"] += 1
            except Exception as e:
                result["cache_error"] = str(e)

    return result


@router.get("/cache-diagnostics")
async def cache_diagnostics(db: AsyncSession = Depends(get_db)):
    """
    Endpoint chẩn đoán cache: ghi 1 entry test, đọc lại, rồi xóa.
    Trả về { "write_ok", "read_ok", "error", "cache_count" }.
    """
    from app.modules.cache.service import CacheService as _CS
    svc = _CS(db)
    test_key = "translate:test:test:diag0000deadbeef"
    result: dict = {"write_ok": False, "read_ok": False, "error": None, "cache_count": 0}
    try:
        # Đếm tổng số entries hiện tại
        listed = await svc.list(skip=0, limit=1)
        result["cache_count"] = listed.get("total", 0)
        # Thử ghi
        await svc.create({"key": test_key, "value": "__diag_test__", "ttl": 3600})
        result["write_ok"] = True
        # Thử đọc lại
        entry = await svc.get_by_key(test_key)
        result["read_ok"] = entry is not None and getattr(entry, "value", "") == "__diag_test__"
        # Xóa entry test
        if entry:
            await svc.delete(entry.id)
    except Exception as e:
        result["error"] = str(e)
    return result


@router.post("", response_model=TranslateResponse)
async def translate(
    body: TranslateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Dịch văn bản theo thứ tự ưu tiên: Cache -> Từ điển game (nếu chọn game) -> Từ điển chung -> AI (Google Gemini).
    game_id (không bắt buộc): khi chọn game, từ điển game áp dụng trước từ điển chung; không chọn thì chỉ dùng cache + từ điển chung + AI.
    Nếu dùng AI, kết quả được lưu cache cho lần sau. Prompt: prompt_id từ Quản lý Prompts hoặc mặc định.
    """
    if not body.text or not body.text.strip():
        logger.info("Translate 400: empty text")
        raise HTTPException(status_code=400, detail="Văn bản cần dịch không được để trống.")
    if not (body.source_lang or "").strip() or not (body.target_lang or "").strip():
        logger.info("Translate 400: missing source or target language")
        raise HTTPException(status_code=400, detail="Vui lòng chọn ngôn ngữ nguồn và ngôn ngữ đích.")
    if body.source_lang == body.target_lang:
        logger.info("Translate 400: source_lang == target_lang")
        raise HTTPException(status_code=400, detail="Ngôn ngữ nguồn và đích phải khác nhau.")

    try:
        translated_text = await translate_with_priority(
            db,
            text=body.text.strip(),
            source_lang=body.source_lang.strip(),
            target_lang=body.target_lang.strip(),
            prompt_id=body.prompt_id,
            context=body.context or None,
            style=body.style or None,
            game_id=body.game_id,
            game_category_id=body.game_category_id,
        )
    except ValueError as e:
        msg = str(e)
        logger.warning("Translate error (ValueError): %s", msg)
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        logger.warning("Translate AI failed, returning original text: %s", e)
        return TranslateResponse(translated_text=body.text.strip())

    return TranslateResponse(translated_text=translated_text)
