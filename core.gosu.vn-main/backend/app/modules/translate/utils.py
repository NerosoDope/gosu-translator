"""
Utils dùng chung cho các file handler (decode nội dung file).
"""


def decode_text(content: bytes) -> str:
    """Thử nhiều encoding để decode bytes thành str."""
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            return content.decode(encoding).strip().lstrip("\ufeff")
        except Exception:
            continue
    return content.decode("utf-8", errors="replace").strip().lstrip("\ufeff")
