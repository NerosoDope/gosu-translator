from pydantic import BaseModel, field_validator
from typing import Optional, Any, List, Dict


class ParseFileResponse(BaseModel):
    """Response cho API parse file Excel/CSV: danh sách cột và vài dòng xem trước."""
    columns: List[str]
    preview_rows: List[Dict[str, str]]


class TranslateFileResponse(BaseModel):
    """Response cho API dịch file: cột (gốc + _translated) và toàn bộ dòng đã dịch. Với file JSON có thêm translated_json (cấu trúc gốc, chỉ cột đã dịch thay đổi)."""
    columns: List[str]
    rows: List[Dict[str, str]]
    translated_json: Optional[Dict[str, Any]] = None


class ExportFileRequest(BaseModel):
    """Request cho API export file kết quả dịch (định dạng theo đuôi file upload)."""
    columns: List[str]
    rows: List[Dict[str, str]]
    format: str  # csv | xlsx | json | xml | docx
    filename: Optional[str] = None  # tên gốc (không đuôi) để đặt tên file tải về


class TranslateRequest(BaseModel):
    text: Optional[str] = ""
    source_lang: Optional[str] = ""
    target_lang: Optional[str] = ""
    prompt_id: Optional[int] = None
    context: Optional[str] = None
    style: Optional[str] = None

    @field_validator("text", "source_lang", "target_lang", mode="before")
    @classmethod
    def str_or_empty(cls, v: Any) -> str:
        if v is None:
            return ""
        return str(v).strip() if isinstance(v, str) else str(v)

    @field_validator("prompt_id", mode="before")
    @classmethod
    def coerce_prompt_id(cls, v: Any) -> Optional[int]:
        if v is None or v == "":
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, str) and v.strip() == "":
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None


class TranslateResponse(BaseModel):
    translated_text: str
