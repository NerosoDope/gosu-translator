from pydantic import BaseModel, field_validator
from typing import Optional, Any, List, Dict


class ParseFileResponse(BaseModel):
    """Response cho API parse file: danh sách cột và vài dòng xem trước.
    DOCX paragraph mode: preview_html chứa HTML đã giữ nguyên heading/bold/italic/list."""
    columns: List[str]
    preview_rows: List[Dict[str, str]]
    preview_html: Optional[str] = None


class TranslateFileResponse(BaseModel):
    """Response cho API dịch file: cột (gốc + _translated) và toàn bộ dòng đã dịch. JSON: translated_json. DOCX: translated_docx_b64 (base64)."""
    columns: List[str]
    rows: List[Dict[str, str]]
    translated_json: Optional[Dict[str, Any]] = None
    translated_docx_b64: Optional[str] = None


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


class ParseAllRowsResponse(BaseModel):
    """Response cho API parse toàn bộ dòng file (dùng cho Hiệu Đính File)."""
    columns: List[str]
    rows: List[Dict[str, str]]
    total: int


class ProofreadRowRequest(BaseModel):
    """Request hiệu đính 1 dòng bằng AI: gửi văn bản gốc + bản dịch hiện tại."""
    original: str
    translated: str
    source_lang: str
    target_lang: str
    prompt_id: Optional[int] = None
    context: Optional[str] = None
    style: Optional[str] = None


class ProofreadRowResponse(BaseModel):
    """Response hiệu đính 1 dòng."""
    proofread: str


class ProofreadBatchItem(BaseModel):
    index: int
    original: str
    translated: str


class ProofreadBatchRequest(BaseModel):
    """Request hiệu đính nhiều dòng cùng lúc (batch AI)."""
    items: List[ProofreadBatchItem]
    source_lang: str
    target_lang: str
    prompt_id: Optional[int] = None
    context: Optional[str] = None
    style: Optional[str] = None


class ProofreadBatchResultItem(BaseModel):
    index: int
    proofread: str


class ProofreadBatchResponse(BaseModel):
    """Response hiệu đính batch."""
    results: List[ProofreadBatchResultItem]
