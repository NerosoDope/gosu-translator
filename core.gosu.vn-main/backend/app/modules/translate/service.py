"""
Translate Service - Dịch theo thứ tự ưu tiên: Cache -> Từ điển game -> Từ điển chung -> AI.
Prompt dịch thuật lấy từ bảng prompts (quản lý prompts) nếu truyền prompt_id.
Batch mode: gộp nhiều đoạn thành 1 lần gọi AI để giảm chi phí.
"""
import hashlib
import logging
import re
from typing import Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.modules.settings.service import SettingsService
from app.modules.prompts.service import PromptsService
from app.modules.language.service import LanguageService
from app.modules.cache.service import CacheService
from app.modules.game_glossary.service import Game_GlossaryService
from app.modules.global_glossary.service import Global_GlossaryService


DEFAULT_SYSTEM_PROMPT = """Bạn là một dịch giả {source_lang} chuyên nghiệp, có nhiều năm kinh nghiệm trong lĩnh vực dịch thuật văn học, kỹ thuật và kịch bản game.

Nhiệm vụ của bạn là dịch các đoạn văn {source_lang} sang {target_lang}, giữ nguyên giọng điệu, định dạng và xuống dòng của nội dung gốc.
Chỉ trả về bản dịch, không giải thích, không thêm tiền tố hay hậu tố."""

# TTL cache mặc định (giây) khi lưu bản dịch AI
TRANSLATE_CACHE_TTL = 86400

# Giới hạn token đầu ra cho AI — tránh API cắt bớt nội dung (default có thể ~1024)
TRANSLATE_MAX_OUTPUT_TOKENS = 8192
TRANSLATE_BATCH_MAX_OUTPUT_TOKENS = 16384

# Số thuật ngữ tối đa inject vào prompt (game glossary + global glossary)
GLOSSARY_PROMPT_MAX_TERMS = 60


async def _fetch_glossary_terms(
    db: AsyncSession,
    source_lang: str,
    target_lang: str,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
    max_terms: int = GLOSSARY_PROMPT_MAX_TERMS,
) -> List[Tuple[str, str]]:
    """Fetch danh sách thuật ngữ (game glossary + global glossary) để inject vào prompt AI.
    Game glossary ưu tiên trước, global glossary bổ sung sau. Giới hạn max_terms để tránh prompt quá dài.
    """
    from sqlalchemy import select as _select
    from app.modules.game_glossary.models import Game_Glossary
    from app.modules.global_glossary.models import Global_Glossary

    language_pair = f"{source_lang.strip()}-{target_lang.strip()}"
    terms: List[Tuple[str, str]] = []

    # 1. Game glossary — ưu tiên thuật ngữ đặc thù của game
    if game_id is not None:
        result = await db.execute(
            _select(Game_Glossary.term, Game_Glossary.translated_term)
            .where(
                Game_Glossary.game_id == game_id,
                Game_Glossary.language_pair == language_pair,
                Game_Glossary.is_active == True,
            )
            .limit(max_terms)
        )
        terms.extend((r.term, r.translated_term) for r in result.all())

    # 2. Global glossary — bổ sung thuật ngữ chung nếu còn chỗ
    remaining = max_terms - len(terms)
    if remaining > 0:
        conditions = [
            Global_Glossary.language_pair == language_pair,
            Global_Glossary.is_active == True,
        ]
        if game_category_id is not None:
            conditions.append(Global_Glossary.game_category_id == game_category_id)
        result = await db.execute(
            _select(Global_Glossary.term, Global_Glossary.translated_term)
            .where(*conditions)
            .limit(remaining)
        )
        terms.extend((r.term, r.translated_term) for r in result.all())

    return terms


def _glossary_prompt_section(terms: List[Tuple[str, str]]) -> str:
    """Tạo đoạn prompt mô tả bảng thuật ngữ cần dùng nhất quán."""
    if not terms:
        return ""
    lines = "\n".join(f"- {t}: {tr}" for t, tr in terms)
    return (
        "\n\nBảng thuật ngữ — hãy dịch các thuật ngữ sau một cách nhất quán "
        "(ưu tiên các bản dịch này hơn lựa chọn mặc định của bạn):\n" + lines
    )


# Nguồn tạo cache (lưu trong cột origin): direct | file | proofread
# Thứ tự ưu tiên khi ghi đè: proofread > direct > file (số cao hơn = ưu tiên cao hơn)
CACHE_ORIGIN_DIRECT = "direct"
CACHE_ORIGIN_FILE = "file"
CACHE_ORIGIN_PROOFREAD = "proofread"
CACHE_ORIGIN_PRIORITY = {CACHE_ORIGIN_PROOFREAD: 3, CACHE_ORIGIN_DIRECT: 2, CACHE_ORIGIN_FILE: 1}


def _origin_priority(origin: Optional[str]) -> int:
    """Ưu tiên nguồn: proofread (3) > direct (2) > file (1). Nguồn khác = 0."""
    return CACHE_ORIGIN_PRIORITY.get((origin or "").strip(), 0)


def _cache_key(source_lang: str, target_lang: str, text: str) -> str:
    """Tạo cache key rút gọn: translate:{source_lang}:{target_lang}:{digest}.
    Ví dụ: translate:vi:en:a92c6a62b6916675
    """
    normalized = " ".join((text.strip() or "").split())
    raw = f"{source_lang}|{target_lang}|{normalized}".encode("utf-8")
    digest = hashlib.sha256(raw).hexdigest()[:16]
    return f"translate:{source_lang}:{target_lang}:{digest}"


async def verify_gemini_api_key(db: AsyncSession) -> Tuple[bool, str]:
    """
    Kiểm tra API key Gemini có hoạt động hay không.
    Dùng cùng model đã cấu hình (gemini_model) để tránh 429 do model khác quota.
    Returns (success, message).
    """
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"

    if not api_key:
        return (False, "Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt để thêm gemini_api_key.")

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        return (False, "Thư viện google-genai chưa được cài đặt. Chạy: pip install google-genai")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents="Say OK",
            config=types.GenerateContentConfig(max_output_tokens=5),
        )
        _ = (response.text or "").strip()
        return (True, "API key hợp lệ và kết nối thành công.")
    except Exception as e:
        err_msg = getattr(e, "message", str(e))
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            return (
                False,
                "Đã hết hạn mức sử dụng Gemini (429). Vui lòng kiểm tra hạn mức tại https://aistudio.google.com/",
            )
        if "api_key" in err_str or "invalid" in err_str or "401" in str(e) or "403" in str(e):
            return (False, f"API key không hợp lệ: {err_msg}")
        return (False, f"Không thể kết nối Gemini: {err_msg}")


async def translate_with_ai(
    db: AsyncSession,
    text: str,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
) -> str:
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"

    if not api_key:
        raise ValueError(
            "Chưa cấu hình Gemini API Key. Vui lòng vào Cài đặt > Hệ thống để thêm gemini_api_key."
        )

    # Resolve mã ngôn ngữ → tên (từ bảng languages) để đưa vào prompt
    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = DEFAULT_SYSTEM_PROMPT.format(
        source_lang=source_name,
        target_lang=target_name,
    )
    if prompt_id:
        prompts_svc = PromptsService(db)
        prompt_obj = await prompts_svc.get(prompt_id)
        if prompt_obj and getattr(prompt_obj, "content", None):
            raw = prompt_obj.content or ""
            # Thay {style_instructions}: nếu style rỗng, xóa luôn khoảng trắng dư xung quanh placeholder
            style_str = style or ""
            if style_str:
                styled = raw.replace("{style_instructions}", style_str)
            else:
                styled = re.sub(r"\s*\{style_instructions\}\s*", " ", raw).strip()
            system_content = (
                styled
                .replace("{source_lang}", source_name)
                .replace("{target_lang}", target_name)
            )
            # Chỉ append style nếu prompt KHÔNG dùng {style_instructions}
            if style_str and "{style_instructions}" not in raw:
                system_content += f"\n\nPhong cách dịch: {style_str}"
    else:
        # Prompt mặc định: không có {style_instructions}, append style riêng
        if style:
            system_content += f"\n\nPhong cách dịch: {style}"
    if context:
        system_content += f"\n\nNgữ cảnh: {context}"

    # Inject từ điển game/global vào prompt để AI dịch nhất quán
    if game_id is not None or game_category_id is not None:
        try:
            glossary_terms = await _fetch_glossary_terms(
                db, source_lang, target_lang, game_id, game_category_id
            )
            system_content += _glossary_prompt_section(glossary_terms)
        except Exception:
            pass  # Không để lỗi fetch glossary làm gián đoạn bản dịch

    user_content = text

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt. Chạy: pip install google-genai")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
                max_output_tokens=TRANSLATE_MAX_OUTPUT_TOKENS,
            ),
        )
        translated = (response.text or "").strip()
    except Exception as e:
        err_msg = getattr(e, "message", str(e))
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError(
                "Đã hết hạn mức sử dụng Gemini (429). Vui lòng kiểm tra hạn mức tại https://aistudio.google.com/"
            )
        raise
    return translated or ""


# Separator dùng để ngăn cách các segment trong batch – không trùng với nội dung thực tế
_BATCH_SEP = "|||SEGMENT|||"

# Prompt batch: yêu cầu AI dịch từng dòng, giữ nguyên cấu trúc đánh số và placeholder __PH_n__
_BATCH_SYSTEM_PROMPT = (
    "Bạn là một dịch giả {source_lang} chuyên nghiệp. "
    "Hãy dịch TỪNG dòng được đánh số từ {source_lang} sang {target_lang}. "
    "Chỉ trả về các dòng đã dịch theo đúng định dạng đánh số, không giải thích, không thêm văn bản nào khác. "
    "Giữ nguyên các placeholder như {{variable}}, %s, %d, {{0}} và chuỗi __PH_0__, __PH_1__, ... (không xóa, không thay thế).\n"
    "Định dạng trả về:\n1. <dòng dịch 1>\n2. <dòng dịch 2>\n..."
)


async def translate_with_ai_batch(
    db: AsyncSession,
    texts: List[str],
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
) -> List[str]:
    """
    Gộp nhiều đoạn text thành 1 lần gọi AI (numbered list). Trả về list kết quả cùng thứ tự.
    Nếu parse thất bại thì fall back sang dịch lẻ.
    """
    if not texts:
        return []
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"
    if not api_key:
        raise ValueError("Chưa cấu hình Gemini API Key.")

    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = _BATCH_SYSTEM_PROMPT.format(source_lang=source_name, target_lang=target_name)
    if prompt_id:
        prompts_svc = PromptsService(db)
        prompt_obj = await prompts_svc.get(prompt_id)
        if prompt_obj and getattr(prompt_obj, "content", None):
            raw = prompt_obj.content or ""
            style_str = style or ""
            if style_str:
                styled = raw.replace("{style_instructions}", style_str)
            else:
                styled = re.sub(r"\s*\{style_instructions\}\s*", " ", raw).strip()
            system_content = (
                styled
                .replace("{source_lang}", source_name)
                .replace("{target_lang}", target_name)
            )
            if style_str and "{style_instructions}" not in raw:
                system_content += f"\n\nPhong cách dịch: {style_str}"
            # Luôn thêm hướng dẫn định dạng batch — custom prompt không có phần này
            system_content += (
                "\n\nHãy dịch TỪNG dòng được đánh số từ "
                f"{source_name} sang {target_name}. "
                "Định dạng trả về (bắt buộc):\n1. <dòng dịch 1>\n2. <dòng dịch 2>\n..."
                "\nChỉ trả về các dòng đã dịch theo đúng định dạng đánh số, không giải thích."
            )
    else:
        if style:
            system_content += f"\n\nPhong cách dịch: {style}"
    if context:
        system_content += f"\n\nNgữ cảnh: {context}"

    # Inject từ điển vào prompt một lần cho toàn bộ batch — tránh N lần DB call
    if game_id is not None or game_category_id is not None:
        try:
            glossary_terms = await _fetch_glossary_terms(
                db, source_lang, target_lang, game_id, game_category_id
            )
            system_content += _glossary_prompt_section(glossary_terms)
        except Exception:
            pass

    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt.")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=numbered,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
                max_output_tokens=TRANSLATE_BATCH_MAX_OUTPUT_TOKENS,
            ),
        )
        raw_output = (response.text or "").strip()
        logger.info("AI batch raw_output (first 300 chars): %s", raw_output[:300])
    except Exception as e:
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError("Đã hết hạn mức sử dụng Gemini (429).")
        logger.error("AI batch call failed: %s", e)
        raise

    # Parse output: mỗi dòng dạng "N. <nội dung>" hoặc "N) <nội dung>" → dict {index: text}
    # Dòng không bắt đầu bằng số (continuation) → gộp vào segment trước để không mất nội dung
    # Cũng xử lý markdown bold: "**N.** text" hoặc "**N.**text"
    import re as _re
    parsed: Dict[int, str] = {}
    last_idx: Optional[int] = None
    for line in raw_output.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        # Xóa markdown bold nếu có: **1.** → 1.
        normalized = _re.sub(r"^\*+(\d+)[.)]\*+\s*", r"\1. ", stripped)
        m = _re.match(r"^(\d+)[.)]\s*(.*)", normalized)
        if m:
            idx = int(m.group(1))
            val = m.group(2).strip()
            if val:
                parsed[idx] = val
                last_idx = idx
        elif last_idx is not None and last_idx in parsed:
            # Dòng tiếp nối (bản dịch xuống dòng) — gộp vào segment trước
            parsed[last_idx] = parsed[last_idx] + "\n" + stripped

    logger.info("AI batch parsed %d/%d items", len(parsed), len(texts))
    if len(parsed) < len(texts):
        missing = [i + 1 for i in range(len(texts)) if (i + 1) not in parsed]
        logger.warning("AI batch missing indices %s — falling back to orig for those", missing)

    # Điền kết quả theo thứ tự gốc; nếu thiếu thì trả chuỗi gốc
    results = []
    for i, orig in enumerate(texts):
        results.append(parsed.get(i + 1) or orig)
    return results


async def translate_check_only(
    db: AsyncSession,
    text: str,
    source_lang: str,
    target_lang: str,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
) -> Optional[str]:
    """
    Chỉ tra Cache + Từ điển (game + chung). KHÔNG gọi AI.
    Trả về bản dịch nếu có, None nếu không có.
    Nếu game_id/game_category_id được chỉ định, chỉ tra trong từ điển tương ứng.
    """
    text = (text or "").strip()
    if not text:
        return ""

    language_pair = f"{source_lang.strip()}-{target_lang.strip()}"
    cache_svc = CacheService(db)
    key = _cache_key(source_lang, target_lang, text)
    cached = await cache_svc.get_by_key(key)
    if cached and getattr(cached, "value", None):
        return (cached.value or "").strip()

    game_glossary_svc = Game_GlossaryService(db)
    game_trans = await game_glossary_svc.find_translation(
        term=text, language_pair=language_pair, game_id=game_id
    )
    if game_trans is not None:
        return game_trans.strip()

    global_glossary_svc = Global_GlossaryService(db)
    global_trans = await global_glossary_svc.find_translation(
        term=text, language_pair=language_pair, game_category_id=game_category_id
    )
    if global_trans is not None:
        return global_trans.strip()

    return None


async def save_translation_to_cache(
    db: AsyncSession,
    text: str,
    translated: str,
    source_lang: str,
    target_lang: str,
    origin: Optional[str] = None,
) -> None:
    """
    Upsert 1 cặp bản dịch vào cache. Key rút gọn translate:vi:en:hash, nguồn lưu trong cột origin.
    origin: direct | file | proofread (mặc định direct).
    Chỉ ghi đè khi nguồn mới có ưu tiên >= nguồn hiện tại: proofread > direct > file.
    """
    if not translated:
        return
    # Không lưu cache khi bản dịch trả về đúng bản gốc (tránh lưu bản dịch "giả")
    orig_stripped = (text or "").strip()
    trans_stripped = (translated or "").strip()
    if orig_stripped and trans_stripped and orig_stripped == trans_stripped:
        return
    origin = (origin or CACHE_ORIGIN_DIRECT).strip() or CACHE_ORIGIN_DIRECT
    key = _cache_key(source_lang, target_lang, text)
    cache_svc = CacheService(db)
    try:
        existing = await cache_svc.get_by_key_any(key)
        if existing:
            current_origin = getattr(existing, "origin", None)
            if _origin_priority(current_origin) > _origin_priority(origin):
                return  # Không ghi đè nguồn có ưu tiên cao hơn
    except Exception as e:
        logger.warning("save_translation_to_cache get_by_key_any: %s", e)
    payload = {"key": key, "value": translated, "ttl": TRANSLATE_CACHE_TTL, "origin": origin, "source_text": text}
    try:
        await cache_svc.create(payload)
    except Exception as e:
        logger.warning("save_translation_to_cache failed key=%s: %s", key[:40], e)
        try:
            await db.rollback()
        except Exception:
            pass


async def translate_with_priority(
    db: AsyncSession,
    text: str,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
    game_id: Optional[int] = None,
    game_category_id: Optional[int] = None,
    quality_check: bool = False,
) -> str:
    """
    Dịch theo thứ tự ưu tiên: 1.Cache 2.Từ điển game 3.Từ điển chung 4.AI (và lưu cache).
    game_id/game_category_id để lọc từ điển theo game/thể loại cụ thể.
    quality_check=True: kiểm tra chất lượng sau dịch, tự động dịch lại nếu score < 60.
    """
    hit = await translate_check_only(
        db, text, source_lang, target_lang,
        game_id=game_id, game_category_id=game_category_id,
    )
    if hit is not None:
        return hit

    text = (text or "").strip()
    translated = await translate_with_ai(
        db,
        text=text,
        source_lang=source_lang,
        target_lang=target_lang,
        prompt_id=prompt_id,
        context=context,
        style=style,
        game_id=game_id,
        game_category_id=game_category_id,
    )

    # Kiểm tra chất lượng và tự động dịch lại nếu cần
    if quality_check and translated:
        from app.modules.quality_check.service import check_quality as _check_quality
        glossary_terms: Optional[List[Tuple[str, str]]] = None
        if game_id is not None or game_category_id is not None:
            try:
                glossary_terms = await _fetch_glossary_terms(
                    db, source_lang, target_lang, game_id, game_category_id
                )
            except Exception:
                pass

        qr = _check_quality(text, translated, source_lang, target_lang, glossary_terms)
        if qr.should_retranslate:
            issues_hint = "; ".join(i.message for i in qr.issues[:3])
            retry_context = f"{context}\nLưu ý cải thiện: {issues_hint}" if context else f"Lưu ý cải thiện: {issues_hint}"
            try:
                retranslated = await translate_with_ai(
                    db,
                    text=text,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    prompt_id=prompt_id,
                    context=retry_context,
                    style=style,
                    game_id=game_id,
                    game_category_id=game_category_id,
                )
                if retranslated and retranslated != translated:
                    retry_qr = _check_quality(text, retranslated, source_lang, target_lang, glossary_terms)
                    if retry_qr.score >= qr.score:
                        translated = retranslated
            except Exception:
                pass  # Giữ bản dịch gốc nếu retry thất bại

    await save_translation_to_cache(db, text, translated, source_lang, target_lang, origin="direct")
    return translated or ""


# ─────────────────────────────────────────────────────────────────────────────
# Proofread (Hiệu Đính) – AI cải thiện bản dịch đã có
# ─────────────────────────────────────────────────────────────────────────────

_PROOFREAD_SYSTEM_PROMPT = (
    "Bạn là một dịch giả và hiệu đính viên {source_lang} chuyên nghiệp. "
    "Hãy xem xét bản dịch được cung cấp và cải thiện nếu cần thiết. "
    "Ngôn ngữ nguồn: {source_lang}. Ngôn ngữ đích: {target_lang}. "
    "Trong văn bản có thể xuất hiện các placeholder đặc biệt dưới dạng __PH_0__, __PH_1__, ... "
    "Đây là các thẻ/ký hiệu kỹ thuật (ví dụ: thẻ HTML như <br>) đã được ẩn đi. "
    "Bạn PHẢI giữ nguyên, không xóa, không thay đổi thứ tự hay nội dung các placeholder này. "
    "Chỉ trả về bản dịch đã được cải thiện. "
    "Nếu bản dịch đã chính xác và tự nhiên, hãy trả về nguyên văn. "
    "Không giải thích, không thêm nhận xét hay ghi chú."
)

_PROOFREAD_BATCH_SYSTEM_PROMPT = (
    "Bạn là một dịch giả và hiệu đính viên {source_lang} chuyên nghiệp. "
    "Hãy xem xét và cải thiện các bản dịch sau đây. "
    "Ngôn ngữ nguồn: {source_lang}. Ngôn ngữ đích: {target_lang}. "
    "Trong văn bản có thể xuất hiện các placeholder đặc biệt dưới dạng __PH_0__, __PH_1__, ... "
    "Đây là các thẻ/ký hiệu kỹ thuật (ví dụ: thẻ HTML như <br>) đã được ẩn đi. "
    "Bạn PHẢI giữ nguyên, không xóa, không thay đổi thứ tự hay nội dung các placeholder này. "
    "Với mỗi mục được đánh số bạn nhận được:\n"
    "  Original: <văn bản gốc>\n"
    "  Current: <bản dịch hiện tại>\n"
    "Chỉ trả về các bản dịch đã cải thiện theo định dạng đánh số:\n"
    "1. <bản dịch đã cải thiện>\n2. <bản dịch đã cải thiện>\n...\n"
    "Nếu bản dịch đã chính xác và tự nhiên, hãy trả về nguyên văn. "
    "Không giải thích, không thêm văn bản nào khác."
)


async def proofread_with_ai(
    db: AsyncSession,
    original: str,
    translated: str,
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
) -> str:
    """Hiệu đính 1 cặp văn bản gốc/bản dịch bằng AI. Trả về bản dịch đã cải thiện."""
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"
    if not api_key:
        raise ValueError("Chưa cấu hình Gemini API Key.")

    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = _PROOFREAD_SYSTEM_PROMPT.format(
        source_lang=source_name, target_lang=target_name
    )
    if prompt_id:
        prompts_svc = PromptsService(db)
        prompt_obj = await prompts_svc.get(prompt_id)
        if prompt_obj and getattr(prompt_obj, "content", None):
            raw = prompt_obj.content or ""
            system_content = (
                raw.replace("{source_lang}", source_name)
                .replace("{target_lang}", target_name)
                .replace("{style_instructions}", style or "")
            )
    if context:
        system_content += f"\n\nNgữ cảnh: {context}"
    if style:
        system_content += f"\n\nPhong cách dịch: {style}"

    user_content = f"Bản gốc: {original}\nBản dịch hiện tại: {translated}"

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt.")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
            ),
        )
        result = (response.text or "").strip()
    except Exception as e:
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError("Đã hết hạn mức sử dụng Gemini (429).")
        raise
    return result or translated


async def proofread_with_ai_batch(
    db: AsyncSession,
    items: List[Dict],
    source_lang: str,
    target_lang: str,
    prompt_id: Optional[int] = None,
    context: Optional[str] = None,
    style: Optional[str] = None,
) -> List[Dict]:
    """
    Hiệu đính nhiều cặp gốc/dịch cùng lúc (batch AI). 
    items: [{"index": int, "original": str, "translated": str}]
    Trả về: [{"index": int, "proofread": str}]
    """
    if not items:
        return []
    settings_svc = SettingsService(db)
    api_key_setting = await settings_svc.get_setting_by_key("gemini_api_key")
    model_setting = await settings_svc.get_setting_by_key("gemini_model")
    api_key = (api_key_setting.value or "").strip() if api_key_setting else ""
    model = (model_setting.value or "gemini-2.5-flash-lite").strip() if model_setting else "gemini-2.5-flash-lite"
    if not api_key:
        raise ValueError("Chưa cấu hình Gemini API Key.")

    language_svc = LanguageService(db)
    source_name = await language_svc.get_name_by_code(source_lang)
    target_name = await language_svc.get_name_by_code(target_lang)

    system_content = _PROOFREAD_BATCH_SYSTEM_PROMPT.format(
        source_lang=source_name, target_lang=target_name
    )
    if context:
        system_content += f"\n\nNgữ cảnh: {context}"
    if style:
        system_content += f"\n\nPhong cách dịch: {style}"

    numbered = "\n".join(
        f"{i+1}.\n  Bản gốc: {item['original']}\n  Bản dịch hiện tại: {item['translated']}"
        for i, item in enumerate(items)
    )

    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ValueError("Thư viện google-genai chưa được cài đặt.")

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model=model,
            contents=numbered,
            config=types.GenerateContentConfig(
                system_instruction=system_content,
                temperature=0.3,
                max_output_tokens=TRANSLATE_BATCH_MAX_OUTPUT_TOKENS,
            ),
        )
        raw_output = (response.text or "").strip()
    except Exception as e:
        err_str = str(e).lower()
        status = getattr(e, "status_code", None) or getattr(e, "http_status", None)
        if status == 429 or "429" in err_str or "quota" in err_str or "resource exhausted" in err_str:
            raise ValueError("Đã hết hạn mức sử dụng Gemini (429).")
        raise

    import re as _re
    parsed: Dict[int, str] = {}
    last_idx: Optional[int] = None
    for line in raw_output.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        m = _re.match(r"^(\d+)\.\s*(.*)", stripped)
        if m:
            idx = int(m.group(1))
            val = m.group(2).strip()
            if val:
                parsed[idx] = val
                last_idx = idx
        elif last_idx is not None and last_idx in parsed:
            parsed[last_idx] = parsed[last_idx] + "\n" + stripped

    results = []
    for i, item in enumerate(items):
        results.append({
            "index": item["index"],
            "proofread": parsed.get(i + 1) or item["translated"],
        })
    return results
