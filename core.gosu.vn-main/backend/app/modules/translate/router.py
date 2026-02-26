import csv
import io
import json
import logging
import re
import xml.etree.ElementTree as ET
from typing import Any, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.modules.translate.schemas import (
    ExportFileRequest,
    ParseFileResponse,
    TranslateFileResponse,
    TranslateRequest,
    TranslateResponse,
)
from app.modules.translate.service import translate_with_priority, verify_gemini_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="", tags=["translate"])

PREVIEW_ROW_LIMIT = 5
TRANSLATE_FILE_MAX_ROWS = 500


def _cell_to_str(value) -> str:
    """Chuyển giá trị ô (Excel/CSV) sang chuỗi."""
    if value is None:
        return ""
    if hasattr(value, "isoformat"):  # datetime.date/datetime
        return value.isoformat()
    return str(value).strip()


def _json_value_to_str(value) -> str:
    """Chuyển giá trị từ JSON sang chuỗi: số/chuỗi/None như ô; dict/list serialize thành JSON (khác Excel)."""
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        try:
            return json.dumps(value, ensure_ascii=False).strip()
        except (TypeError, ValueError):
            return str(value).strip()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value).strip() if value is not None else ""


async def _parse_excel(content: bytes) -> ParseFileResponse:
    """Đọc file .xlsx (openpyxl), trả về columns và preview_rows."""
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="openpyxl chưa được cài đặt. Vui lòng cài: pip install openpyxl",
        )
    workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet = workbook.active
    if not sheet:
        return ParseFileResponse(columns=[], preview_rows=[])
    # Dòng 1 = header
    header_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not header_row:
        return ParseFileResponse(columns=[], preview_rows=[])
    columns = [_cell_to_str(h) for h in header_row]
    # Đảm bảo tên cột unique (trùng thì thêm _2, _3...)
    seen = {}
    unique_columns = []
    for c in columns:
        if not c:
            c = "Cột"
        key = c
        if key in seen:
            seen[key] += 1
            c = f"{c}_{seen[key]}"
        else:
            seen[key] = 1
        unique_columns.append(c)
    columns = unique_columns
    preview_rows = []
    for row in sheet.iter_rows(min_row=2, max_row=1 + PREVIEW_ROW_LIMIT, values_only=True):
        row_dict = {}
        for i, col_name in enumerate(columns):
            row_dict[col_name] = _cell_to_str(row[i]) if i < len(row) else ""
        preview_rows.append(row_dict)
    workbook.close()
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


async def _parse_csv(content: bytes) -> ParseFileResponse:
    """Đọc file CSV (dòng 1 = header), trả về columns và preview_rows."""
    try:
        text = content.decode("utf-8-sig").strip()
    except Exception:
        text = content.decode("utf-8", errors="replace").strip()
    lines = text.splitlines()
    if not lines:
        return ParseFileResponse(columns=[], preview_rows=[])
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header:
        return ParseFileResponse(columns=[], preview_rows=[])
    columns = [h.strip() or "Cột" for h in header]
    seen = {}
    unique_columns = []
    for c in columns:
        key = c
        if key in seen:
            seen[key] = seen.get(key, 1) + 1
            c = f"{c}_{seen[key]}"
        else:
            seen[key] = 1
        unique_columns.append(c)
    columns = unique_columns
    preview_rows = []
    for _ in range(PREVIEW_ROW_LIMIT):
        row = next(reader, None)
        if row is None:
            break
        row_dict = {}
        for i, col_name in enumerate(columns):
            row_dict[col_name] = (row[i].strip() if i < len(row) else "")
        preview_rows.append(row_dict)
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


def _rows_from_json(data) -> Tuple[List[str], List[dict]]:
    """Từ cấu trúc JSON (list of dict, dict với key chứa mảng object, dict đơn, list of list, ...) trả về columns và rows."""
    if isinstance(data, dict):
        # Nếu root là object có key chứa mảng object (vd. {"users": [{...}, {...}]}) thì dùng mảng đó làm dòng
        for _k, v in data.items():
            if isinstance(v, list) and len(v) > 0 and all(isinstance(item, dict) for item in v):
                return _rows_from_json(v)
        columns = [str(c) or "Cột" for c in data.keys()]
        if not columns:
            return ["Nội dung"], []
        row = {c: _json_value_to_str(data.get(k)) for k, c in zip(list(data.keys()), columns)}
        return columns, [row]
    if isinstance(data, list):
        if len(data) == 0:
            return ["Nội dung"], []
        first = data[0]
        if isinstance(first, dict):
            all_keys = []
            for row in data:
                if isinstance(row, dict):
                    for k in row:
                        if k not in all_keys:
                            all_keys.append(k)
            columns = [str(k) or "Cột" for k in all_keys]
            if not columns:
                columns = ["Nội dung"]
            seen = {}
            unique = []
            for c in columns:
                key = c
                if key in seen:
                    seen[key] += 1
                    c = f"{c}_{seen[key]}"
                else:
                    seen[key] = 1
                unique.append(c)
            rows = []
            for item in data:
                if not isinstance(item, dict):
                    continue
                row = {}
                for i, col in enumerate(unique):
                    orig_key = all_keys[i] if i < len(all_keys) else col
                    val = item.get(orig_key)
                    row[col] = _json_value_to_str(val)
                rows.append(row)
            return unique, rows
        if isinstance(first, (list, tuple)):
            # Mảng 2 chiều: dòng đầu = header
            columns = [str(v) or f"Cột{i+1}" for i, v in enumerate(first)]
            if not columns:
                columns = ["Nội dung"]
            seen = {}
            unique = []
            for c in columns:
                key = c
                if key in seen:
                    seen[key] += 1
                    c = f"{c}_{seen[key]}"
                else:
                    seen[key] = 1
                unique.append(c)
            rows = []
            for item in data[1:]:
                if not isinstance(item, (list, tuple)):
                    continue
                row = {}
                for i, col in enumerate(unique):
                    val = item[i] if i < len(item) else None
                    row[col] = _json_value_to_str(val)
                rows.append(row)
            return unique, rows
        return ["Nội dung"], [{"Nội dung": _json_value_to_str(first)}]
    return ["Nội dung"], [{"Nội dung": _json_value_to_str(data)}]


def _decode_text(content: bytes) -> str:
    """Thử nhiều encoding để decode bytes thành str."""
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return content.decode(encoding).strip().lstrip("\ufeff")
        except Exception:
            continue
    return content.decode("utf-8", errors="replace").strip().lstrip("\ufeff")


# --- Dịch JSON giữ nguyên cấu trúc (chỉ dịch value string) ---

# Regex cho Smart Filter: không dịch URL, email, ISO date, số thuần, enum (ALL_CAPS ngắn)
_RE_URL = re.compile(r"^https?://\S+$", re.I)
_RE_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_RE_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}(T|\s)?(\d{2}:\d{2}:\d{2})?")  # 2026-02-26 hoặc 2026-02-26T10:00:00
_RE_NUMBER = re.compile(r"^-?\d+(\.\d+)?$")
_RE_ENUM_LIKE = re.compile(r"^[A-Z][A-Z0-9_]{1,50}$")  # ADMIN, PENDING, SUCCESS


def _should_translate_string(s: str, smart_filter: bool) -> bool:
    """Strict: chỉ dịch chuỗi có nội dung. Smart Filter: bỏ qua URL, email, số, ngày ISO, enum."""
    if not s or not isinstance(s, str):
        return False
    s = s.strip()
    if not s:
        return False
    if not smart_filter:
        return True
    if _RE_URL.match(s):
        return False
    if _RE_EMAIL.match(s):
        return False
    if _RE_ISO_DATE.match(s):
        return False
    if _RE_NUMBER.match(s):
        return False
    if _RE_ENUM_LIKE.match(s):
        return False
    return True


# Placeholder preservation: {username}, %d, %s, %1$s, {{count}}
_RE_PLACEHOLDER = re.compile(r"(\{[^}]+\}|\{\{[^}]+\}\}|%\d*\$?[sdfc]|%[sdf])")


def _extract_placeholders(s: str) -> Tuple[str, List[str]]:
    """Thay placeholder bằng __PH_n__, trả về (chuỗi đã thay), danh sách placeholder gốc."""
    if not s:
        return s, []
    placeholders: List[str] = []
    def repl(m):
        placeholders.append(m.group(1))
        return f"__PH_{len(placeholders)-1}__"
    out = _RE_PLACEHOLDER.sub(repl, s)
    return out, placeholders


def _restore_placeholders(s: str, placeholders: List[str]) -> str:
    """Khôi phục __PH_n__ bằng placeholder gốc."""
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
                    ) or k
                except Exception:
                    pass
            out[key] = await _translate_json_recursive(
                v, db, source_lang, target_lang,
                prompt_id, context, style, smart_filter, translate_keys,
            )
        return out
    return obj


def _plain_text_lines_to_rows(text: str) -> Tuple[List[str], List[dict]]:
    """Khi file .json không phải JSON hợp lệ: coi mỗi dòng là một dòng dữ liệu, cột 'Nội dung'."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return ["Nội dung"], [{"Nội dung": line} for line in lines]


async def _parse_json(content: bytes) -> ParseFileResponse:
    """Đọc file JSON (array of objects, object, array of arrays, hoặc array rỗng). Nếu không phải JSON hợp lệ thì đọc theo từng dòng (plain text)."""
    if not content:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    text = _decode_text(content)
    if not text:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        columns, all_rows = _plain_text_lines_to_rows(text)
        preview_rows = all_rows[:PREVIEW_ROW_LIMIT]
        return ParseFileResponse(columns=columns, preview_rows=preview_rows)
    columns, all_rows = _rows_from_json(data)
    if not columns:
        columns = ["Nội dung"]
    preview_rows = all_rows[:PREVIEW_ROW_LIMIT]
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


def _read_full_json(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
    """Đọc toàn bộ file JSON, trả về columns và rows (tối đa max_rows). Nếu không phải JSON hợp lệ thì đọc theo từng dòng."""
    if not content:
        return [], []
    text = _decode_text(content)
    if not text:
        return [], []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        columns, all_rows = _plain_text_lines_to_rows(text)
        return columns, all_rows[:max_rows]
    columns, all_rows = _rows_from_json(data)
    if not columns:
        columns = ["Nội dung"]
    return columns, all_rows[:max_rows]


def _xml_local_tag(el: ET.Element) -> str:
    """Lấy tên thẻ không namespace (phần sau dấu })."""
    tag = el.tag if hasattr(el, "tag") else ""
    if isinstance(tag, str) and "}" in tag:
        return tag.split("}", 1)[1]
    return tag or "col"


def _xml_element_full_text(el: ET.Element) -> str:
    """Lấy toàn bộ nội dung text của phần tử XML (text + nội dung con lồng nhau + tail). Khác Excel: XML có cấu trúc cây."""
    if el is None:
        return ""
    parts = [el.text or ""]
    for child in el:
        parts.append(_xml_element_full_text(child))
        parts.append(child.tail or "")
    return "".join(parts).strip()


def _rows_from_xml(root: ET.Element) -> Tuple[List[str], List[dict]]:
    """Từ root XML tìm các phần tử con lặp lại (kể cả lồng nhau như segments/segment), thuộc tính + thẻ con → cột."""
    children = list(root)
    if not children:
        text = _xml_element_full_text(root)
        if text:
            return ["Nội dung"], [{"Nội dung": text}]
        return ["Nội dung"], []

    # Tìm nhánh có danh sách phần tử lặp (vd. <segments><segment/> <segment/>...</segments>)
    row_container = None
    for el in children:
        sub = list(el)
        if len(sub) > 0 and (row_container is None or len(sub) > len(list(row_container))):
            row_container = el
    if row_container is not None:
        row_elements = list(row_container)
        if not row_elements:
            pass
        else:
            first_row = row_elements[0]
            # Cột = thuộc tính (vd. id) + tên thẻ con (vd. source, target)
            attr_names = list(first_row.attrib.keys())
            child_tags = []
            for ch in first_row:
                name = _xml_local_tag(ch)
                if name not in child_tags:
                    child_tags.append(name)
            columns = attr_names + child_tags
            if not columns:
                columns = ["Nội dung"]
            seen = {}
            unique = []
            for c in columns:
                key = c
                if key in seen:
                    seen[key] += 1
                    c = f"{c}_{seen[key]}"
                else:
                    seen[key] = 1
                unique.append(c)
            rows = []
            for el in row_elements:
                row_dict = {}
                for i, col in enumerate(unique):
                    if i < len(attr_names):
                        row_dict[col] = (el.attrib.get(attr_names[i], "") or "").strip()
                    else:
                        tag_idx = i - len(attr_names)
                        tag_name = child_tags[tag_idx] if tag_idx < len(child_tags) else col
                        child_el = None
                        for e in el:
                            if _xml_local_tag(e) == tag_name:
                                child_el = e
                                break
                        row_dict[col] = _xml_element_full_text(child_el) if child_el is not None else ""
                rows.append(row_dict)
            return unique, rows

    # Fallback: root's direct children = rows, cột từ thẻ đầu hoặc từ con của thẻ đầu
    first = children[0]
    first_tag = _xml_local_tag(first)
    sub = list(first)
    if not sub:
        columns = [first_tag]
        rows = []
        for el in children:
            rows.append({_xml_local_tag(el): _xml_element_full_text(el)})
        return columns, rows
    columns = []
    for c in sub:
        name = _xml_local_tag(c)
        if name not in columns:
            columns.append(name)
    if not columns:
        columns = ["Nội dung"]
    seen = {}
    unique = []
    for c in columns:
        key = c
        if key in seen:
            seen[key] += 1
            c = f"{c}_{seen[key]}"
        else:
            seen[key] = 1
        unique.append(c)
    rows = []
    for el in children:
        row = {}
        for i, col in enumerate(unique):
            orig = columns[i] if i < len(columns) else col
            child = None
            for e in el:
                if _xml_local_tag(e) == orig:
                    child = e
                    break
            if child is None:
                child = el.find(orig)
            if child is not None:
                row[col] = _xml_element_full_text(child)
            else:
                row[col] = ""
        rows.append(row)
    return unique, rows


def _strip_xml_declaration(text: str) -> str:
    """Bỏ dòng khai báo <?xml ...?> để tránh lỗi parse do encoding."""
    stripped = text.strip().lstrip("\ufeff")
    if stripped.startswith("<?xml"):
        idx = stripped.find("?>")
        if idx != -1:
            stripped = stripped[idx + 2 :].strip()
    return stripped


def _split_xml_declaration(text: str) -> Tuple[str, str]:
    """Trả về (declaration_line, rest). Declaration có thể rỗng."""
    stripped = text.strip().lstrip("\ufeff")
    if stripped.startswith("<?xml"):
        idx = stripped.find("?>")
        if idx != -1:
            return stripped[: idx + 2].strip(), stripped[idx + 2 :].strip()
    return "", stripped


# --- Dịch XML giữ cấu trúc: chỉ text trong thẻ, không dịch attribute/tên thẻ, giữ placeholder ---
XML_UI_TAGS = frozenset({"string", "text", "description", "title", "message", "label", "subtitle", "content"})


def _is_xml_translatable(el: ET.Element, respect_translatable: bool) -> bool:
    """Chỉ dịch thẻ UI (string, text, ...) hoặc có translatable=\"true\"; bỏ qua translatable=\"false\"."""
    tag = _xml_local_tag(el)
    if respect_translatable:
        trans = (el.attrib.get("translatable") or "").strip().lower()
        if trans == "false":
            return False
        if trans == "true":
            return True
    return tag.lower() in XML_UI_TAGS


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
) -> None:
    """
    Duyệt cây XML, chỉ dịch text bên trong thẻ (el.text, child.tail). Không dịch attribute, tên thẻ.
    Giữ placeholder {x}, %d, %s, {{count}}. Chỉ dịch thẻ UI hoặc translatable=\"true\".
    Sửa tại chỗ (in-place).
    """
    if el is None:
        return
    translatable = _is_xml_translatable(el, respect_translatable)

    async def do_translate(t: str) -> str:
        if not t or not t.strip():
            return t
        orig = t
        if preserve_placeholders:
            t, phs = _extract_placeholders(t)
        else:
            phs = []
        if not _should_translate_string(t, smart_filter):
            return orig
        try:
            out = await translate_with_priority(
                db, text=t.strip(), source_lang=source_lang, target_lang=target_lang,
                prompt_id=prompt_id, context=context, style=style,
            ) or t.strip()
            if preserve_placeholders and phs:
                out = _restore_placeholders(out, phs)
            return out
        except Exception as e:
            logger.warning("Translate XML text: %s", e)
            return orig

    if translatable and el.text and el.text.strip():
        el.text = await do_translate(el.text)

    for child in el:
        await _translate_xml_recursive(
            child, db, source_lang, target_lang,
            prompt_id, context, style,
            preserve_placeholders, respect_translatable, smart_filter,
        )
        if translatable and child.tail and child.tail.strip():
            child.tail = await do_translate(child.tail)


def _xml_to_string(root: ET.Element, declaration: str = "") -> str:
    """Serialize element tree thành chuỗi XML. Nếu declaration có giá trị thì ghi lên trước."""
    buf = io.BytesIO()
    if declaration:
        buf.write(declaration.strip().encode("utf-8"))
        buf.write(b"\n")
    ET.ElementTree(root).write(buf, encoding="utf-8", xml_declaration=False, default_namespace="", method="xml")
    return buf.getvalue().decode("utf-8")


async def _parse_xml(content: bytes) -> ParseFileResponse:
    """Đọc file XML. Không trả 400 khi lỗi parse, trả dữ liệu mặc định."""
    if not content:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    text = _decode_text(content)
    if not text:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    text = _strip_xml_declaration(text)
    if not text:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    columns, all_rows = _rows_from_xml(root)
    if not columns:
        columns = ["Nội dung"]
    preview_rows = all_rows[:PREVIEW_ROW_LIMIT]
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


def _read_full_xml(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
    """Đọc toàn bộ file XML, trả về columns và rows (tối đa max_rows)."""
    if not content:
        return [], []
    text = _decode_text(content)
    if not text:
        return [], []
    text = _strip_xml_declaration(text)
    if not text:
        return [], []
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return [], []
    columns, all_rows = _rows_from_xml(root)
    if not columns:
        columns = ["Nội dung"]
    return columns, all_rows[:max_rows]


async def _parse_docx(content: bytes) -> ParseFileResponse:
    """Đọc file .docx (paragraphs hoặc bảng đầu tiên), trả về columns và preview_rows."""
    try:
        from docx import Document
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Hỗ trợ DOCX cần cài thư viện: pip install python-docx (sau đó khởi động lại backend).",
        )
    if not content or len(content) < 4:
        raise HTTPException(status_code=400, detail="File DOCX rỗng hoặc không đúng định dạng.")
    try:
        doc = Document(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không đọc được file DOCX (file có thể hỏng hoặc không phải .docx): {str(e)[:200]}")
    if doc.tables:
        table = doc.tables[0]
        header_cells = table.rows[0].cells
        columns = [_cell_to_str(c.text) for c in header_cells]
        if not columns:
            columns = ["Nội dung"]
        seen = {}
        unique = []
        for c in columns:
            key = c or "Cột"
            if key in seen:
                seen[key] += 1
                c = f"{c or 'Cột'}_{seen[key]}"
            else:
                seen[key] = 1
                c = c or "Cột"
            unique.append(c)
        preview_rows = []
        for row in list(table.rows)[1 : 1 + PREVIEW_ROW_LIMIT]:
            row_dict = {}
            for i, col in enumerate(unique):
                row_dict[col] = _cell_to_str(row.cells[i].text) if i < len(row.cells) else ""
            preview_rows.append(row_dict)
        return ParseFileResponse(columns=unique, preview_rows=preview_rows)
    columns = ["Nội dung"]
    preview_rows = []
    for p in list(doc.paragraphs)[:PREVIEW_ROW_LIMIT]:
        text = (p.text or "").strip()
        preview_rows.append({"Nội dung": text})
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


def _read_full_docx(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
    """Đọc toàn bộ file .docx, trả về columns và rows (tối đa max_rows)."""
    try:
        from docx import Document
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Hỗ trợ DOCX cần cài: pip install python-docx và khởi động lại backend.",
        )
    if not content or len(content) < 4:
        return [], []
    try:
        doc = Document(io.BytesIO(content))
    except Exception:
        return [], []
    if doc.tables:
        table = doc.tables[0]
        header_cells = table.rows[0].cells
        columns = [_cell_to_str(c.text) for c in header_cells]
        if not columns:
            columns = ["Nội dung"]
        seen = {}
        unique = []
        for c in columns:
            key = c or "Cột"
            if key in seen:
                seen[key] += 1
                c = f"{c or 'Cột'}_{seen[key]}"
            else:
                seen[key] = 1
                c = c or "Cột"
            unique.append(c)
        rows = []
        for row in list(table.rows)[1 : 1 + max_rows]:
            row_dict = {}
            for i, col in enumerate(unique):
                row_dict[col] = _cell_to_str(row.cells[i].text) if i < len(row.cells) else ""
            rows.append(row_dict)
        return unique, rows
    columns = ["Nội dung"]
    rows = []
    for p in list(doc.paragraphs)[:max_rows]:
        rows.append({"Nội dung": (p.text or "").strip()})
    return columns, rows


def _read_full_excel(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
    """Đọc toàn bộ file .xlsx (openpyxl), trả về columns và toàn bộ rows (tối đa max_rows dòng dữ liệu)."""
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="openpyxl chưa được cài đặt. Vui lòng cài: pip install openpyxl",
        )
    workbook = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    sheet = workbook.active
    if not sheet:
        return [], []
    header_row = next(sheet.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if not header_row:
        workbook.close()
        return [], []
    columns = [_cell_to_str(h) for h in header_row]
    seen = {}
    unique_columns = []
    for c in columns:
        if not c:
            c = "Cột"
        key = c
        if key in seen:
            seen[key] += 1
            c = f"{c}_{seen[key]}"
        else:
            seen[key] = 1
        unique_columns.append(c)
    columns = unique_columns
    rows = []
    for row in sheet.iter_rows(min_row=2, max_row=1 + max_rows, values_only=True):
        row_dict = {}
        for i, col_name in enumerate(columns):
            row_dict[col_name] = _cell_to_str(row[i]) if i < len(row) else ""
        rows.append(row_dict)
    workbook.close()
    return columns, rows


def _read_full_csv(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
    """Đọc toàn bộ file CSV, trả về columns và toàn bộ rows (tối đa max_rows dòng dữ liệu)."""
    try:
        text = content.decode("utf-8-sig").strip()
    except Exception:
        text = content.decode("utf-8", errors="replace").strip()
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header:
        return [], []
    columns = [h.strip() or "Cột" for h in header]
    seen = {}
    unique_columns = []
    for c in columns:
        key = c
        if key in seen:
            seen[key] = seen.get(key, 1) + 1
            c = f"{c}_{seen[key]}"
        else:
            seen[key] = 1
        unique_columns.append(c)
    columns = unique_columns
    rows = []
    for _ in range(max_rows):
        row = next(reader, None)
        if row is None:
            break
        row_dict = {}
        for i, col_name in enumerate(columns):
            row_dict[col_name] = (row[i].strip() if i < len(row) else "")
        rows.append(row_dict)
    return columns, rows


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
        return await _parse_excel(content)
    if name.endswith(".csv"):
        return await _parse_csv(content)
    if name.endswith(".json"):
        return await _parse_json(content)
    if name.endswith(".xml"):
        return await _parse_xml(content)
    if name.endswith(".docx"):
        return await _parse_docx(content)
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
    context = (context or "").strip() or None
    style = (style or "").strip() or None

    if name.endswith(".xlsx"):
        columns, rows = _read_full_excel(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".csv"):
        columns, rows = _read_full_csv(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".json"):
        columns, rows = _read_full_json(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".xml"):
        columns, rows = _read_full_xml(content, TRANSLATE_FILE_MAX_ROWS)
    elif name.endswith(".docx"):
        columns, rows = _read_full_docx(content, TRANSLATE_FILE_MAX_ROWS)
    else:
        columns, rows = [], []

    to_translate = [c for c in selected_set if c in columns]
    if not to_translate:
        # Trả 200 với dữ liệu rỗng thay vì 400 (tránh lỗi "Failed to load resource" khi JSON/XML parse lỗi)
        fallback_cols = list(selected_set) if selected_set else (columns or ["Nội dung"])
        return TranslateFileResponse(columns=fallback_cols, rows=[])

    for row_idx, row in enumerate(rows):
        for col in to_translate:
            text = (row.get(col) or "").strip()
            if not text:
                row[col + "_translated"] = ""
                continue
            try:
                translated = await translate_with_priority(
                    db,
                    text=text,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    prompt_id=prompt_id_int,
                    context=context,
                    style=style,
                )
                row[col + "_translated"] = translated or ""
            except Exception as e:
                logger.warning("Translate file cell row=%s col=%s: %s", row_idx, col, e)
                row[col + "_translated"] = f"[Lỗi: {str(e)[:80]}]"

    output_columns = columns + [c + "_translated" for c in to_translate]
    translated_json = None
    if name.endswith(".json"):
        try:
            text = _decode_text(content)
            data_original = json.loads(text)
            for _k, v in data_original.items():
                if isinstance(v, list) and len(v) > 0 and all(isinstance(x, dict) for x in v):
                    for i in range(min(len(v), len(rows))):
                        for col in to_translate:
                            if col in v[i]:
                                v[i][col] = rows[i].get(col + "_translated", v[i][col])
                    translated_json = data_original
                    break
        except (json.JSONDecodeError, TypeError):
            pass
    return TranslateFileResponse(columns=output_columns, rows=rows, translated_json=translated_json)


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
    text = _decode_text(content)
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
    context = (context or "").strip() or None
    style = (style or "").strip() or None

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
    )
    body = json.dumps(result, ensure_ascii=False, indent=2)
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
    text = _decode_text(content)
    decl, rest = _split_xml_declaration(text)
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
    )
    out_body = (_xml_to_string(root, declaration=decl) if decl else _xml_to_string(root))
    filename = (file.filename or "translated").replace(".xml", "") + "_translated.xml"
    return Response(
        content=out_body.encode("utf-8"),
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _export_csv(columns: List[str], rows: List[dict]) -> bytes:
    out = io.StringIO()
    out.write("\uFEFF")
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([str(row.get(c, "") or "") for c in columns])
    return out.getvalue().encode("utf-8")


def _export_xlsx(columns: List[str], rows: List[dict]) -> bytes:
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(status_code=503, detail="openpyxl chưa được cài đặt.")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(columns)
    for row in rows:
        ws.append([str(row.get(c, "") or "") for c in columns])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _export_json(columns: List[str], rows: List[dict]) -> bytes:
    data = [dict((c, row.get(c, "") or "") for c in columns) for row in rows]
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def _xml_tag(s: str) -> str:
    """Tên thẻ XML hợp lệ (chữ, số, _)."""
    return "".join(c if c.isalnum() or c == "_" else "_" for c in (s or "col"))


def _export_xml(columns: List[str], rows: List[dict]) -> bytes:
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<rows>"]
    for row in rows:
        lines.append("  <row>")
        for c in columns:
            val = (row.get(c) or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
            tag = _xml_tag(c)
            lines.append(f"    <{tag}>{val}</{tag}>")
        lines.append("  </row>")
    lines.append("</rows>")
    return "\n".join(lines).encode("utf-8")


def _export_docx(columns: List[str], rows: List[dict]) -> bytes:
    try:
        from docx import Document
    except ImportError:
        raise HTTPException(status_code=503, detail="python-docx chưa được cài đặt.")
    doc = Document()
    table = doc.add_table(rows=1 + len(rows), cols=len(columns))
    for j, col in enumerate(columns):
        table.rows[0].cells[j].text = str(col)
    for i, row in enumerate(rows):
        for j, col in enumerate(columns):
            table.rows[i + 1].cells[j].text = str(row.get(col, "") or "")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


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
        content = _export_csv(columns, rows)
        media_type = "text/csv; charset=utf-8"
    elif fmt == "xlsx":
        content = _export_xlsx(columns, rows)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif fmt == "json":
        content = _export_json(columns, rows)
        media_type = "application/json; charset=utf-8"
    elif fmt == "xml":
        content = _export_xml(columns, rows)
        media_type = "application/xml; charset=utf-8"
    else:
        content = _export_docx(columns, rows)
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


@router.post("", response_model=TranslateResponse)
async def translate(
    body: TranslateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Dịch văn bản theo thứ tự ưu tiên: Cache -> Từ điển game -> Từ điển chung -> AI (Google Gemini).
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
        )
    except ValueError as e:
        msg = str(e)
        logger.warning("Translate error (ValueError): %s", msg)
        raise HTTPException(status_code=400, detail=msg)
    except Exception as e:
        logger.exception("Translate AI failed: %s", e)
        raise HTTPException(
            status_code=502,
            detail=f"Dịch bằng AI thất bại: {getattr(e, 'message', str(e))}",
        )

    return TranslateResponse(translated_text=translated_text)
