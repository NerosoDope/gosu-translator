"""Schemas cho Quality Check module."""

from pydantic import BaseModel, Field
from typing import List, Optional


class QualityCheckRequest(BaseModel):
    source: str = Field(..., description="Văn bản gốc")
    translated: str = Field(..., description="Bản dịch cần kiểm tra")
    source_lang: str = Field("", description="Ngôn ngữ nguồn (tham khảo)")
    target_lang: str = Field("", description="Ngôn ngữ đích (tham khảo)")
    glossary_terms: Optional[List[List[str]]] = Field(
        None,
        description="Danh sách thuật ngữ từ điển: [[thuật_ngữ_gốc, bản_dịch], ...]",
    )


class QualityIssueSchema(BaseModel):
    category: str = Field(..., description="Nhóm tiêu chí: error_signs, length_ratio, special_chars, sentence_structure, translation_quality, consistency")
    severity: str = Field(..., description="Mức độ: critical | major | minor")
    message: str = Field(..., description="Mô tả vấn đề")
    suggestion: str = Field("", description="Gợi ý cải thiện")
    deduction: int = Field(0, description="Điểm bị trừ")


class QualityCheckResponse(BaseModel):
    score: int = Field(..., description="Điểm chất lượng 0-100")
    verdict: str = Field(..., description="Kết luận: Tốt | Chấp nhận được | Cần cải thiện | Cần dịch lại")
    issues: List[QualityIssueSchema] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list, description="Gợi ý tổng hợp")
    should_retranslate: bool = Field(..., description="True nếu điểm < 60 → nên dịch lại")


class QualityCheckBatchRequest(BaseModel):
    items: List[QualityCheckRequest] = Field(..., description="Danh sách cặp cần kiểm tra")


class QualityCheckBatchResponse(BaseModel):
    results: List[QualityCheckResponse]
    avg_score: float = Field(..., description="Điểm trung bình toàn batch")
    retranslate_count: int = Field(..., description="Số lượng cần dịch lại (score < 60)")
