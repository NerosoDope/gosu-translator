"""Quality Check Router — POST /api/v1/quality-check"""

from fastapi import APIRouter
from app.modules.quality_check.schemas import (
    QualityCheckRequest,
    QualityCheckResponse,
    QualityIssueSchema,
    QualityCheckBatchRequest,
    QualityCheckBatchResponse,
)
from app.modules.quality_check.service import check_quality

router = APIRouter()


def _to_response(req: QualityCheckRequest) -> QualityCheckResponse:
    glossary: list = []
    for item in req.glossary_terms or []:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            glossary.append((str(item[0]), str(item[1])))

    result = check_quality(
        source=req.source,
        translated=req.translated,
        source_lang=req.source_lang or "",
        target_lang=req.target_lang or "",
        glossary_terms=glossary or None,
    )
    return QualityCheckResponse(
        score=result.score,
        verdict=result.verdict,
        issues=[
            QualityIssueSchema(
                category=i.category,
                severity=i.severity,
                message=i.message,
                suggestion=i.suggestion,
                deduction=i.deduction,
            )
            for i in result.issues
        ],
        suggestions=result.suggestions,
        should_retranslate=result.should_retranslate,
    )


@router.post("", response_model=QualityCheckResponse, summary="Kiểm tra chất lượng 1 bản dịch")
async def quality_check_single(body: QualityCheckRequest) -> QualityCheckResponse:
    """
    Đánh giá chất lượng 1 cặp (gốc / dịch) theo 6 tiêu chí:
    - Dấu hiệu lỗi
    - Tỷ lệ độ dài
    - Ký tự đặc biệt / Placeholder
    - Cấu trúc câu
    - Chất lượng dịch
    - Tính nhất quán (glossary)

    Trả về score 0-100, verdict, danh sách issues và gợi ý.
    `should_retranslate = true` khi score < 60.
    """
    return _to_response(body)


@router.post("/batch", response_model=QualityCheckBatchResponse, summary="Kiểm tra chất lượng nhiều bản dịch")
async def quality_check_batch(body: QualityCheckBatchRequest) -> QualityCheckBatchResponse:
    """
    Đánh giá chất lượng nhiều cặp dịch cùng lúc.
    Trả về danh sách kết quả, điểm trung bình và số lượng cần dịch lại.
    """
    results = [_to_response(item) for item in body.items]
    avg_score = sum(r.score for r in results) / max(len(results), 1)
    retranslate_count = sum(1 for r in results if r.should_retranslate)
    return QualityCheckBatchResponse(
        results=results,
        avg_score=round(avg_score, 1),
        retranslate_count=retranslate_count,
    )
