"""
Xử lý file XML: đọc, parse preview, đọc full, xuất. Hỗ trợ Android Resources, XLIFF, generic XML.
"""
import io
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Tuple

from app.modules.translate.schemas import ParseFileResponse
from app.modules.translate.utils import decode_text


def xml_local_tag(el: ET.Element) -> str:
    """Lấy tên thẻ không namespace (phần sau dấu })."""
    tag = el.tag if hasattr(el, "tag") else ""
    if isinstance(tag, str) and "}" in tag:
        return tag.split("}", 1)[1]
    return tag or "col"


def xml_element_full_text(el: ET.Element) -> str:
    """Lấy toàn bộ nội dung text của phần tử XML (text + nội dung con + tail)."""
    if el is None:
        return ""
    parts = [el.text or ""]
    for child in el:
        parts.append(xml_element_full_text(child))
        parts.append(child.tail or "")
    return "".join(parts).strip()


def _rows_from_android_xml(root: ET.Element) -> Tuple[List[str], List[dict]]:
    """Parser cho Android Resource XML (<resources>). Columns: ["name", "value"]."""
    columns = ["name", "value"]
    rows: List[dict] = []
    for el in root:
        tag = xml_local_tag(el)
        if el.attrib.get("translatable", "true").lower() == "false":
            continue
        el_name = el.attrib.get("name", "")
        if tag == "string":
            value = xml_element_full_text(el).strip()
            rows.append({"name": el_name, "value": value})
        elif tag == "plurals":
            for item in el:
                qty = item.attrib.get("quantity", "")
                value = xml_element_full_text(item).strip()
                rows.append({"name": f"{el_name}[{qty}]", "value": value})
        elif tag == "string-array":
            for idx, item in enumerate(el):
                value = xml_element_full_text(item).strip()
                rows.append({"name": f"{el_name}[{idx}]", "value": value})
        elif tag in ("integer", "bool", "color", "dimen"):
            continue
        else:
            value = xml_element_full_text(el).strip()
            if value:
                rows.append({"name": el_name or tag, "value": value})
    return columns, rows


def _rows_from_xliff(root: ET.Element) -> Tuple[List[str], List[dict]]:
    """Parser cho XLIFF 1.2/2.0. Columns: ["id", "source", "target"]."""
    columns = ["id", "source", "target"]
    rows: List[dict] = []

    def _collect_units(node: ET.Element) -> None:
        tag = xml_local_tag(node)
        if tag in ("trans-unit", "unit"):
            uid = node.attrib.get("id", "")
            src_el = node.find(".//{*}source") or node.find("source")
            tgt_el = node.find(".//{*}target") or node.find("target")
            src = xml_element_full_text(src_el).strip() if src_el is not None else ""
            tgt = xml_element_full_text(tgt_el).strip() if tgt_el is not None else ""
            if src or tgt:
                rows.append({"id": uid, "source": src, "target": tgt})
        for child in node:
            _collect_units(child)

    _collect_units(root)
    return columns, rows


def rows_from_xml(root: ET.Element) -> Tuple[List[str], List[dict]]:
    """
    Dispatcher: nhận diện định dạng XML rồi chọn parser phù hợp.
    Android Resources, XLIFF, hoặc generic repeating-container XML.
    """
    root_tag = xml_local_tag(root)

    if root_tag == "resources":
        return _rows_from_android_xml(root)

    if root_tag in ("xliff", "file") or root.find(".//{*}trans-unit") is not None or root.find(".//{*}unit") is not None:
        return _rows_from_xliff(root)

    children = list(root)
    if not children:
        text = xml_element_full_text(root)
        return (["Nội dung"], [{"Nội dung": text}]) if text else (["Nội dung"], [])

    # Trường hợp root là container, mỗi child (VD: Item) là một dòng, con của child là cột (ID, Title, Description...)
    first = children[0]
    sub = list(first)
    if len(sub) >= 1:
        first_tag_set = sorted({xml_local_tag(c) for c in sub})
        if all(sorted({xml_local_tag(c) for c in el}) == first_tag_set for el in children if list(el)):
            cols_set: List[str] = []
            for c in sub:
                nm = xml_local_tag(c)
                if nm not in cols_set:
                    cols_set.append(nm)
            seen: dict = {}
            unique: List[str] = []
            for c in cols_set:
                if c in seen:
                    seen[c] += 1
                    unique.append(f"{c}_{seen[c]}")
                else:
                    seen[c] = 1
                    unique.append(c)
            rows = []
            for el in children:
                row_dict: dict = {}
                for i, col in enumerate(unique):
                    orig = cols_set[i] if i < len(cols_set) else col
                    child_el = next((e for e in el if xml_local_tag(e) == orig), None) or el.find(orig)
                    row_dict[col] = xml_element_full_text(child_el) if child_el is not None else ""
                rows.append(row_dict)
            return unique, rows

    # Tìm container có nhiều con nhất (bảng lồng nhau)
    row_container = None
    for el in children:
        sub_el = list(el)
        if len(sub_el) > 1 and (row_container is None or len(sub_el) > len(list(row_container))):
            row_container = el

    if row_container is not None:
        row_elements = list(row_container)
        if row_elements:
            first_row = row_elements[0]
            attr_names = list(first_row.attrib.keys())
            child_tags: List[str] = []
            for ch in first_row:
                name = xml_local_tag(ch)
                if name not in child_tags:
                    child_tags.append(name)
            cols_raw = attr_names + child_tags or ["Nội dung"]
            seen2: dict = {}
            unique2: List[str] = []
            for c in cols_raw:
                if c in seen2:
                    seen2[c] += 1
                    unique2.append(f"{c}_{seen2[c]}")
                else:
                    seen2[c] = 1
                    unique2.append(c)
            rows = []
            for el in row_elements:
                row_dict: dict = {}
                for i, col in enumerate(unique2):
                    if i < len(attr_names):
                        row_dict[col] = (el.attrib.get(attr_names[i], "") or "").strip()
                    else:
                        tag_idx = i - len(attr_names)
                        tag_name = child_tags[tag_idx] if tag_idx < len(child_tags) else col
                        child_el = next((e for e in el if xml_local_tag(e) == tag_name), None)
                        row_dict[col] = xml_element_full_text(child_el) if child_el is not None else ""
                rows.append(row_dict)
            return unique2, rows

    first = children[0]
    sub = list(first)
    if not sub:
        all_tags = sorted({xml_local_tag(e) for e in children})
        if len(all_tags) == 1:
            cols = [all_tags[0]]
            return cols, [{all_tags[0]: xml_element_full_text(e)} for e in children]
        return ["tag", "value"], [{"tag": xml_local_tag(e), "value": xml_element_full_text(e)} for e in children]

    cols_set: List[str] = []
    for c in sub:
        nm = xml_local_tag(c)
        if nm not in cols_set:
            cols_set.append(nm)
    seen2: dict = {}
    unique2: List[str] = []
    for c in cols_set:
        if c in seen2:
            seen2[c] += 1
            unique2.append(f"{c}_{seen2[c]}")
        else:
            seen2[c] = 1
            unique2.append(c)
    rows2 = []
    for el in children:
        row: dict = {}
        for i, col in enumerate(unique2):
            orig = cols_set[i] if i < len(cols_set) else col
            child_el = next((e for e in el if xml_local_tag(e) == orig), None) or el.find(orig)
            row[col] = xml_element_full_text(child_el) if child_el is not None else ""
        rows2.append(row)
    return unique2, rows2


def parse_xml_string_to_rows(content: str) -> Tuple[List[str], List[Dict[str, str]], str, str, Dict[str, str], str]:
    """
    Parse chuỗi XML thành columns, rows và metadata để rebuild (hiệu đính).
    Trả về (columns, rows, root_tag, row_tag, root_attribs, declaration).
    """
    if not (content or "").strip():
        return ["Nội dung"], [], "root", "row", {}, ""
    raw = content.strip().lstrip("\ufeff")
    decl, text = split_xml_declaration(raw)
    if not text:
        return ["Nội dung"], [], "root", "row", {}, decl
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return ["Nội dung"], [], "root", "row", {}, decl
    columns, rows = rows_from_xml(root)
    if not columns:
        columns = ["Nội dung"]
    root_tag = xml_local_tag(root)
    root_attribs = {k: v for k, v in root.attrib.items()}
    children = list(root)
    row_tag = xml_local_tag(children[0]) if children else "row"
    if len(rows) != len(children) and children:
        row_tag = "row"
    return columns, rows, root_tag, row_tag, root_attribs, decl


def _safe_tag(s: str) -> str:
    """Tên thẻ XML hợp lệ (chữ, số, _)."""
    return "".join(c if c.isalnum() or c == "_" else "_" for c in (s or "col"))


def rebuild_xml_from_rows(
    root_tag: str,
    row_tag: str,
    root_attribs: Dict[str, str],
    columns: List[str],
    rows: List[Dict[str, str]],
    declaration: str = "",
) -> str:
    """Dựng lại chuỗi XML từ rows (sau hiệu đính)."""
    buf: List[str] = []
    if declaration and declaration.strip().startswith("<?xml"):
        buf.append(declaration.strip())
    attr_str = "".join(f' {k}="{_escape_attr(v)}"' for k, v in (root_attribs or {}).items())
    buf.append(f"<{root_tag}{attr_str}>")
    for row in rows:
        buf.append(f"  <{row_tag}>")
        for col in columns:
            val = (row.get(col) or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
            tag = _safe_tag(col)
            buf.append(f"    <{tag}>{val}</{tag}>")
        buf.append(f"  </{row_tag}>")
    buf.append(f"</{root_tag}>")
    return "\n".join(buf)


def _escape_attr(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def strip_xml_declaration(text: str) -> str:
    """Bỏ dòng khai báo <?xml ...?> để tránh lỗi parse do encoding."""
    stripped = text.strip().lstrip("\ufeff")
    if stripped.startswith("<?xml"):
        idx = stripped.find("?>")
        if idx != -1:
            stripped = stripped[idx + 2:].strip()
    return stripped


def split_xml_declaration(text: str) -> Tuple[str, str]:
    """Trả về (declaration_line, rest). Declaration có thể rỗng."""
    stripped = text.strip().lstrip("\ufeff")
    if stripped.startswith("<?xml"):
        idx = stripped.find("?>")
        if idx != -1:
            return stripped[:idx + 2].strip(), stripped[idx + 2:].strip()
    return "", stripped


def xml_to_string(root: ET.Element, declaration: str = "") -> str:
    """Serialize element tree thành chuỗi XML. Nếu declaration có giá trị thì ghi lên trước."""
    buf = io.BytesIO()
    if declaration:
        buf.write(declaration.strip().encode("utf-8"))
        buf.write(b"\n")
    ET.ElementTree(root).write(buf, encoding="utf-8", xml_declaration=False, default_namespace="", method="xml")
    return buf.getvalue().decode("utf-8")


async def parse_xml(content: bytes, preview_limit: int = 5) -> ParseFileResponse:
    """Đọc file XML. Không trả 400 khi lỗi parse, trả dữ liệu mặc định.
    Trả columns + preview_rows để hiển thị xem trước theo cột (giống JSON)."""
    if not content:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    text = decode_text(content)
    if not text:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    text = strip_xml_declaration(text)
    if not text:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    columns, all_rows = rows_from_xml(root)
    if not columns:
        columns = ["Nội dung"]
    preview_rows = all_rows[:preview_limit]
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


def read_full_xml(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
    """Đọc toàn bộ file XML, trả về columns và rows (tối đa max_rows)."""
    if not content:
        return [], []
    text = decode_text(content)
    if not text:
        return [], []
    text = strip_xml_declaration(text)
    if not text:
        return [], []
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return [], []
    columns, all_rows = rows_from_xml(root)
    if not columns:
        columns = ["Nội dung"]
    return columns, all_rows[:max_rows]


def xml_tag(s: str) -> str:
    """Tên thẻ XML hợp lệ (chữ, số, _)."""
    return "".join(c if c.isalnum() or c == "_" else "_" for c in (s or "col"))


def export_xml(columns: List[str], rows: List[dict]) -> bytes:
    """Xuất columns + rows ra XML (rows/row/col)."""
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', "<rows>"]
    for row in rows:
        lines.append("  <row>")
        for c in columns:
            val = (row.get(c) or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
            tag = xml_tag(c)
            lines.append(f"    <{tag}>{val}</{tag}>")
        lines.append("  </row>")
    lines.append("</rows>")
    return "\n".join(lines).encode("utf-8")
