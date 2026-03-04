"""
Xử lý file CSV: đọc, parse preview, đọc full, xuất.
"""
import csv
import io
from typing import List, Tuple

from app.modules.translate.schemas import ParseFileResponse


async def parse_csv(content: bytes, preview_limit: int = 5) -> ParseFileResponse:
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
    for _ in range(preview_limit):
        row = next(reader, None)
        if row is None:
            break
        row_dict = {}
        for i, col_name in enumerate(columns):
            row_dict[col_name] = (row[i].strip() if i < len(row) else "")
        preview_rows.append(row_dict)
    return ParseFileResponse(columns=columns, preview_rows=preview_rows)


def read_full_csv(content: bytes, max_rows: int) -> Tuple[List[str], List[dict]]:
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


def export_csv(columns: List[str], rows: List[dict]) -> bytes:
    """Xuất columns + rows ra file CSV (UTF-8 BOM)."""
    out = io.StringIO()
    out.write("\uFEFF")
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow([str(row.get(c, "") or "") for c in columns])
    return out.getvalue().encode("utf-8")
