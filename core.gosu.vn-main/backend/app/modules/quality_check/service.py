"""
Quality Check Service - Kiểm tra chất lượng bản dịch theo 6 tiêu chí.

Tiêu chí:
  1. Dấu hiệu lỗi       — phát hiện lỗi hệ thống, bản dịch rỗng, chưa được dịch
  2. Tỷ lệ độ dài        — tỷ lệ độ dài giữa bản dịch và văn bản gốc
  3. Ký tự đặc biệt      — kiểm tra placeholder, HTML tags được giữ nguyên
  4. Cấu trúc câu        — số câu, dấu câu kết thúc
  5. Chất lượng dịch     — nội dung có chữ, số liệu quan trọng được giữ
  6. Tính nhất quán      — thuật ngữ từ điển được dùng đúng
"""
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

# Ngưỡng điểm quyết định
RETRANSLATE_THRESHOLD = 60   # score < 60 → tự động dịch lại
WARN_THRESHOLD = 75           # score < 75 → cảnh báo

# Regex placeholder (giữ nhất quán với translate/router.py)
_RE_PLACEHOLDER = re.compile(
    r"("
    r"\{\{[^}]+\}\}"            # {{count}}
    r"|\{[^}]+\}"               # {username}
    r"|\$\{[^}]+\}"             # ${var}
    r"|%\d*\$?[sdifcq%]"        # %s %d %1$s %02d
    r"|%[sdicfqoxXeEgGp%]"      # C-style printf
    r"|@[A-Za-z_][A-Za-z0-9_]*@"  # @name@
    r"|<[A-Za-z_][A-Za-z0-9_]*>"  # <var>
    r")"
)
_RE_SENTENCE_END = re.compile(r"[.!?。！？]")
_RE_NUMBER = re.compile(r"\b\d+(?:[.,]\d+)?\b")
_RE_ERROR_MARKER = re.compile(r"^\[Lỗi:", re.IGNORECASE)
_RE_HAS_LETTER = re.compile(
    r"[a-zA-ZÀ-ỹ\u00C0-\u024F\u1E00-\u1EFF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]"
)

# Mức khấu trừ theo severity
_DEDUCTION = {"critical": 30, "major": 12, "minor": 4}

# Trần khấu trừ mỗi category (để 1 category không trừ hết điểm)
_CAT_CAP = {
    "error_signs": 60,
    "length_ratio": 15,
    "special_chars": 30,
    "sentence_structure": 12,
    "translation_quality": 20,
    "consistency": 20,
}


@dataclass
class QualityIssue:
    category: str   # error_signs | length_ratio | special_chars | sentence_structure | translation_quality | consistency
    severity: str   # critical | major | minor
    message: str
    suggestion: str = ""
    deduction: int = 0


@dataclass
class QualityResult:
    score: int                          # 0 – 100
    verdict: str                        # Tốt | Chấp nhận được | Cần cải thiện | Cần dịch lại
    issues: List[QualityIssue] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)
    should_retranslate: bool = False


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _count_placeholders(text: str) -> dict:
    counts: dict = {}
    for m in _RE_PLACEHOLDER.finditer(text):
        ph = m.group(0)
        counts[ph] = counts.get(ph, 0) + 1
    return counts


def _build_result(score: int, issues: List[QualityIssue]) -> QualityResult:
    score = max(0, min(100, score))
    if score >= 85:
        verdict = "Tốt"
    elif score >= WARN_THRESHOLD:
        verdict = "Chấp nhận được"
    elif score >= RETRANSLATE_THRESHOLD:
        verdict = "Cần cải thiện"
    else:
        verdict = "Cần dịch lại"

    suggestions = _generate_suggestions(issues)
    return QualityResult(
        score=score,
        verdict=verdict,
        issues=issues,
        suggestions=suggestions,
        should_retranslate=score < RETRANSLATE_THRESHOLD,
    )


def _generate_suggestions(issues: List[QualityIssue]) -> List[str]:
    """Tổng hợp gợi ý không trùng, ưu tiên critical → major → minor."""
    seen: set = set()
    suggestions: List[str] = []
    for issue in sorted(
        issues,
        key=lambda x: {"critical": 0, "major": 1, "minor": 2}.get(x.severity, 3),
    ):
        s = (issue.suggestion or "").strip()
        if s and s not in seen:
            suggestions.append(s)
            seen.add(s)
    return suggestions


def _cap_deduction(cat_totals: dict, category: str, amount: int) -> int:
    """Giới hạn khấu trừ mỗi category để không vượt trần _CAT_CAP."""
    cap = _CAT_CAP.get(category, 20)
    already = cat_totals.get(category, 0)
    allowed = max(0, cap - already)
    actual = min(amount, allowed)
    cat_totals[category] = already + actual
    return actual


# ─────────────────────────────────────────────────────────────────────────────
# Main function
# ─────────────────────────────────────────────────────────────────────────────

def check_quality(
    source: str,
    translated: str,
    source_lang: str = "",
    target_lang: str = "",
    glossary_terms: Optional[List[Tuple[str, str]]] = None,
) -> QualityResult:
    """
    Đánh giá chất lượng bản dịch theo 6 tiêu chí. Trả về điểm 0-100 và danh sách vấn đề.

    Args:
        source:         Văn bản gốc.
        translated:     Bản dịch cần kiểm tra.
        source_lang:    Mã/tên ngôn ngữ nguồn (để ghi vào thông báo).
        target_lang:    Mã/tên ngôn ngữ đích.
        glossary_terms: Danh sách [(thuật_ngữ_gốc, bản_dịch_thuật_ngữ)] từ từ điển.

    Returns:
        QualityResult với score, verdict, issues, suggestions, should_retranslate.
    """
    issues: List[QualityIssue] = []
    cat_totals: dict = {}   # theo dõi tổng khấu trừ theo category
    total_deduction = 0

    src = (source or "").strip()
    tgt = (translated or "").strip()

    def add_issue(category: str, severity: str, message: str, suggestion: str = "") -> None:
        nonlocal total_deduction
        base = _DEDUCTION[severity]
        actual = _cap_deduction(cat_totals, category, base)
        if actual > 0:
            total_deduction += actual
        issues.append(QualityIssue(
            category=category,
            severity=severity,
            message=message,
            suggestion=suggestion,
            deduction=actual,
        ))

    # ─── Tiêu chí 1: Dấu hiệu lỗi ────────────────────────────────────────────
    if not tgt:
        issues.append(QualityIssue(
            category="error_signs", severity="critical",
            message="Bản dịch trống rỗng.",
            suggestion="Dịch lại đoạn văn này.",
            deduction=100,
        ))
        return _build_result(0, issues)

    if _RE_ERROR_MARKER.match(tgt):
        issues.append(QualityIssue(
            category="error_signs", severity="critical",
            message="Bản dịch chứa thông báo lỗi hệ thống.",
            suggestion="Dịch lại — AI hoặc API gặp sự cố khi dịch đoạn này.",
            deduction=100,
        ))
        return _build_result(0, issues)

    if src and tgt.lower() == src.lower():
        add_issue(
            "error_signs", "critical",
            "Bản dịch giống hệt văn bản gốc — có thể chưa được dịch.",
            "Kiểm tra lại hoặc dịch thủ công đoạn này.",
        )

    # ─── Tiêu chí 2: Tỷ lệ độ dài ────────────────────────────────────────────
    if src:
        ratio = len(tgt) / max(len(src), 1)
        if ratio < 0.1 or ratio > 8.0:
            add_issue(
                "length_ratio", "major",
                f"Độ dài bản dịch bất thường (tỷ lệ {ratio:.1f}x so với gốc).",
                "Kiểm tra xem bản dịch có đủ nội dung không hoặc bị cắt bớt/thừa.",
            )
        elif ratio < 0.25 or ratio > 5.0:
            add_issue(
                "length_ratio", "minor",
                f"Độ dài bản dịch hơi bất thường (tỷ lệ {ratio:.1f}x so với gốc).",
                "Xem xét lại bản dịch có đủ/thừa ý so với gốc không.",
            )

    # ─── Tiêu chí 3: Ký tự đặc biệt / Placeholder ────────────────────────────
    src_phs = _count_placeholders(src)
    tgt_phs = _count_placeholders(tgt)

    for ph, count in src_phs.items():
        tgt_count = tgt_phs.get(ph, 0)
        if tgt_count < count:
            missing = count - tgt_count
            for _ in range(missing):
                add_issue(
                    "special_chars", "critical",
                    f"Placeholder '{ph}' bị mất trong bản dịch.",
                    f"Thêm lại '{ph}' vào đúng vị trí trong bản dịch.",
                )
        elif tgt_count > count:
            add_issue(
                "special_chars", "minor",
                f"Placeholder '{ph}' xuất hiện thêm {tgt_count - count} lần so với gốc.",
                f"Kiểm tra lại số lần dùng '{ph}' trong bản dịch.",
            )

    for ph in tgt_phs:
        if ph not in src_phs:
            add_issue(
                "special_chars", "minor",
                f"Placeholder '{ph}' trong bản dịch không có trong gốc.",
                f"Xóa placeholder '{ph}' không cần thiết trong bản dịch.",
            )

    # ─── Tiêu chí 4: Cấu trúc câu ────────────────────────────────────────────
    if src:
        # Dấu câu kết thúc
        src_end = src[-1]
        tgt_end = tgt[-1] if tgt else ""
        if src_end in ".!?。！？" and tgt_end not in ".!?。！？":
            add_issue(
                "sentence_structure", "minor",
                "Bản dịch thiếu dấu câu kết thúc.",
                f"Thêm dấu '{src_end}' vào cuối bản dịch.",
            )

        # Số câu chênh lệch
        src_sent = max(1, len(_RE_SENTENCE_END.findall(src)))
        tgt_sent = max(1, len(_RE_SENTENCE_END.findall(tgt)))
        if src_sent > 1 and abs(src_sent - tgt_sent) > max(1, src_sent // 3):
            add_issue(
                "sentence_structure", "minor",
                f"Số câu không khớp (gốc: {src_sent} câu, dịch: {tgt_sent} câu).",
                "Kiểm tra xem có câu nào bị bỏ sót hoặc ghép nhầm không.",
            )

    # ─── Tiêu chí 5: Chất lượng dịch ─────────────────────────────────────────
    if tgt and not _RE_HAS_LETTER.search(tgt):
        add_issue(
            "translation_quality", "major",
            "Bản dịch không chứa ký tự chữ — có thể dịch sai định dạng.",
            "Dịch lại và kiểm tra kết quả đầu ra của AI.",
        )

    # Số liệu quan trọng (giá, cấp độ...)
    src_numbers = set(_RE_NUMBER.findall(src))
    tgt_numbers = set(_RE_NUMBER.findall(tgt))
    missing_nums = src_numbers - tgt_numbers
    if missing_nums and 1 <= len(missing_nums) <= 3:
        add_issue(
            "translation_quality", "minor",
            f"Số liệu {sorted(missing_nums)} có trong gốc nhưng không thấy trong bản dịch.",
            "Kiểm tra lại các con số, cấp độ hoặc giá trị trong bản dịch.",
        )

    # ─── Tiêu chí 6: Tính nhất quán (Glossary) ────────────────────────────────
    if glossary_terms:
        for src_term, tgt_term in glossary_terms:
            if not (src_term or "").strip() or not (tgt_term or "").strip():
                continue
            if re.search(re.escape(src_term.strip()), src, re.IGNORECASE):
                if not re.search(re.escape(tgt_term.strip()), tgt, re.IGNORECASE):
                    add_issue(
                        "consistency", "major",
                        f"Thuật ngữ '{src_term}' không được dịch là '{tgt_term}' theo từ điển.",
                        f"Thay thế bản dịch của '{src_term}' thành '{tgt_term}'.",
                    )

    # ─── Tổng hợp ─────────────────────────────────────────────────────────────
    return _build_result(100 - total_deduction, issues)


# ─────────────────────────────────────────────────────────────────────────────
# Hàm tiện ích: lấy tên category hiển thị
# ─────────────────────────────────────────────────────────────────────────────

CATEGORY_LABELS = {
    "error_signs":          "Dấu hiệu lỗi",
    "length_ratio":         "Tỷ lệ độ dài",
    "special_chars":        "Ký tự đặc biệt",
    "sentence_structure":   "Cấu trúc câu",
    "translation_quality":  "Chất lượng dịch",
    "consistency":          "Tính nhất quán",
}

SEVERITY_LABELS = {
    "critical": "Nghiêm trọng",
    "major":    "Quan trọng",
    "minor":    "Nhỏ",
}
