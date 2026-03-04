"""
Xử lý file JSON: đọc, parse preview, đọc full, xuất, tái tạo JSON đã dịch.
"""
import json
from typing import Any, Dict, List, Optional, Tuple

from app.modules.translate.schemas import ParseFileResponse
from app.modules.translate.utils import decode_text


def json_value_to_str(value) -> str:
    """Chuyển giá trị từ JSON sang chuỗi: số/chuỗi/None như ô; dict/list serialize thành JSON."""
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


def rows_from_json(data) -> Tuple[List[str], List[dict]]:
    """Từ cấu trúc JSON (list of dict, dict với key chứa mảng object, ...) trả về columns và rows."""
    if isinstance(data, dict):
        for _k, v in data.items():
            if isinstance(v, list) and len(v) > 0 and all(isinstance(item, dict) for item in v):
                return rows_from_json(v)
        columns = [str(c) or "Cột" for c in data.keys()]
        if not columns:
            return ["Nội dung"], []
        row = {c: json_value_to_str(data.get(k)) for k, c in zip(list(data.keys()), columns)}
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
                    row[col] = json_value_to_str(val)
                rows.append(row)
            return unique, rows
        if isinstance(first, (list, tuple)):
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
                    row[col] = json_value_to_str(val)
                rows.append(row)
            return unique, rows
        return ["Nội dung"], [{"Nội dung": json_value_to_str(first)}]
    return ["Nội dung"], [{"Nội dung": json_value_to_str(data)}]


def plain_text_lines_to_rows(text: str) -> Tuple[List[str], List[dict]]:
    """Khi file .json không phải JSON hợp lệ: coi mỗi dòng là một dòng dữ liệu, cột 'Nội dung'."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return ["Nội dung"], [{"Nội dung": line} for line in lines]


async def parse_json(content: bytes, preview_limit: int = 5) -> ParseFileResponse:
    """Đọc file JSON (array of objects, object, ...). Nếu không phải JSON hợp lệ thì đọc theo từng dòng."""
    if not content:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    text = decode_text(content)
    if not text:
        return ParseFileResponse(columns=["Nội dung"], preview_rows=[])
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        columns, all_rows = plain_text_lines_to_rows(text)
        preview_rows = all_rows[:preview_limit]
        return ParseFileResponse(columns=columns, preview_rows=preview_rows)
    columns, all_rows = rows_from_json(data)
    if not columns:
        columns = ["Nội dung"]
    preview_rows = all_rows[:preview_limit]
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


def read_full_json(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
    """Đọc toàn bộ file JSON, trả về columns và rows (tối đa max_rows)."""
    if not content:
        return [], []
    text = decode_text(content)
    if not text:
        return [], []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        columns, all_rows = plain_text_lines_to_rows(text)
        return columns, all_rows[:max_rows]
    columns, all_rows = rows_from_json(data)
    if not columns:
        columns = ["Nội dung"]
    return columns, all_rows[:max_rows]


def export_json(columns: List[str], rows: List[dict]) -> bytes:
    """Xuất columns + rows ra JSON (array of objects)."""
    data = [dict((c, row.get(c, "") or "") for c in columns) for row in rows]
    return json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")


def reconstruct_translated_json(
    content: bytes,
    rows: List[dict],
    to_translate: List[str],
) -> Optional[Dict[str, Any]]:
    """
    Tái tạo JSON gốc với các trường đã dịch, giữ nguyên cấu trúc nested.
    """
    def _try_parse_json_value(translated_str: str, original_value: Any) -> Any:
        if not isinstance(original_value, (dict, list)):
            return translated_str
        if not translated_str or not isinstance(translated_str, str):
            return original_value
        t = translated_str.strip()
        if not (t.startswith("{") or t.startswith("[")):
            return translated_str
        try:
            return json.loads(t)
        except (json.JSONDecodeError, ValueError):
            return translated_str

    def _merge_translated_row(target: dict, row: dict) -> None:
        for col in to_translate:
            if col not in target:
                continue
            translated_val = row.get(col + "_translated")
            if translated_val is None:
                continue
            target[col] = _try_parse_json_value(translated_val, target[col])

    try:
        raw_text = decode_text(content)
        data: Any = json.loads(raw_text)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None

    if isinstance(data, list) and len(data) > 0 and all(isinstance(x, dict) for x in data):
        for i in range(min(len(data), len(rows))):
            _merge_translated_row(data[i], rows[i])
        return data

    if not isinstance(data, dict):
        return None

    for _k, v in data.items():
        if isinstance(v, list) and len(v) > 0 and all(isinstance(x, dict) for x in v):
            for i in range(min(len(v), len(rows))):
                _merge_translated_row(v[i], rows[i])
            return data

    if rows:
        _merge_translated_row(data, rows[0])
    return data
