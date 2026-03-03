"""
Job State Machine

Định nghĩa trạng thái hợp lệ và các chuyển trạng thái (transitions) cho Job.

                  ┌─────────────────────────────────┐
                  │                                 │
   create ──► pending ──► in_progress ──► completed │ (terminal)
                  │  ▲        │                     │
                  │  │        ├──► review (đã có thay đổi dù 1 dòng, nhưng lỗi sau đó — vd trả về text gốc)
                  │  │        │         │           │
              cancelled ◄── failed      └── retry ──┘
                  │  ▲
                  │  │ retry
                  └──┘
                                                    │
   Soft-delete có thể áp dụng với mọi trạng thái.  │
   Hard-delete chỉ khi đã soft-delete.              │
   ──────────────────────────────────────────────────┘

Bảng chuyển trạng thái:
┌─────────────────┬──────────────────────────────────────────────────────┐
│ Trạng thái hiện │ Trạng thái tiếp theo hợp lệ                          │
├─────────────────┼──────────────────────────────────────────────────────┤
│ pending         │ in_progress, cancelled                               │
│ in_progress     │ completed, failed, review, cancelled                 │  # failed = không dịch ra gì; review = có thay đổi nhưng lỗi
│ completed       │ (terminal — không chuyển được)                       │
│ failed          │ pending (retry)                                      │
│ cancelled       │ pending (retry)                                      │
│ review          │ pending (retry), completed (đánh dấu xong xem lại)  │
└─────────────────┴──────────────────────────────────────────────────────┘
"""

from enum import Enum
from typing import Set, Dict


class JobStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REVIEW = "review"  # Đã có thay đổi (dù 1 dòng) nhưng lỗi ở đoạn sau — vd trả về text gốc


# Các trạng thái terminal (không thể chuyển tiếp)
TERMINAL_STATES: Set[JobStatus] = {JobStatus.COMPLETED}

# Bảng chuyển trạng thái hợp lệ
VALID_TRANSITIONS: Dict[JobStatus, Set[JobStatus]] = {
    JobStatus.PENDING:      {JobStatus.IN_PROGRESS, JobStatus.CANCELLED},
    JobStatus.IN_PROGRESS:  {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.REVIEW, JobStatus.CANCELLED},
    JobStatus.COMPLETED:    set(),  # terminal
    JobStatus.FAILED:       {JobStatus.PENDING},   # retry
    JobStatus.CANCELLED:    {JobStatus.PENDING},   # retry
    JobStatus.REVIEW:       {JobStatus.PENDING, JobStatus.COMPLETED},  # retry hoặc đánh dấu hoàn thành sau khi xem lại
}

# Các action được phép ở từng trạng thái (dùng cho frontend buttons)
ALLOWED_ACTIONS: Dict[JobStatus, Set[str]] = {
    JobStatus.PENDING:      {"cancel", "edit", "delete"},
    JobStatus.IN_PROGRESS:  {"cancel", "edit", "delete"},
    JobStatus.COMPLETED:    {"delete"},
    JobStatus.FAILED:       {"retry", "delete"},
    JobStatus.CANCELLED:    {"retry", "delete"},
    JobStatus.REVIEW:       {"retry", "delete"},
}

# Label hiển thị tiếng Việt
STATUS_LABELS: Dict[JobStatus, str] = {
    JobStatus.PENDING:      "Chờ xử lý",
    JobStatus.IN_PROGRESS:  "Đang xử lý",
    JobStatus.COMPLETED:    "Hoàn thành",
    JobStatus.FAILED:       "Thất bại",
    JobStatus.CANCELLED:    "Đã hủy",
    JobStatus.REVIEW:       "Cần xem lại",
}


def validate_transition(from_status: str, to_status: str) -> None:
    """
    Kiểm tra chuyển trạng thái hợp lệ.
    Raises ValueError nếu chuyển trạng thái không được phép.
    """
    try:
        from_state = JobStatus(from_status)
        to_state = JobStatus(to_status)
    except ValueError:
        raise ValueError(f"Trạng thái không hợp lệ: '{from_status}' hoặc '{to_status}'")

    if from_state == to_state:
        return  # không thay đổi → OK

    allowed = VALID_TRANSITIONS.get(from_state, set())
    if to_state not in allowed:
        if from_state in TERMINAL_STATES:
            raise ValueError(
                f"Job đã '{STATUS_LABELS[from_state]}' — không thể thay đổi trạng thái."
            )
        allowed_labels = [STATUS_LABELS[s] for s in allowed] if allowed else []
        raise ValueError(
            f"Không thể chuyển từ '{STATUS_LABELS[from_state]}' sang '{STATUS_LABELS[to_state]}'. "
            f"Các trạng thái hợp lệ tiếp theo: {', '.join(allowed_labels) or 'Không có'}."
        )


def can_transition(from_status: str, to_status: str) -> bool:
    """Trả về True nếu chuyển trạng thái hợp lệ, không raise exception."""
    try:
        validate_transition(from_status, to_status)
        return True
    except ValueError:
        return False


def get_allowed_actions(status: str, is_deleted: bool = False) -> Set[str]:
    """Lấy danh sách actions hợp lệ cho một job theo trạng thái."""
    if is_deleted:
        return {"restore", "hard_delete"}
    try:
        state = JobStatus(status)
        return ALLOWED_ACTIONS.get(state, set())
    except ValueError:
        return set()
