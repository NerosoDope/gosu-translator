"""
Import Batches Models - Lưu lịch sử import từ điển

Dùng để rollback khi import sai - xoá toàn bộ bản ghi theo import_id.
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.session import Base


class ImportBatch(Base):
    """Lịch sử mỗi lần import Excel"""
    __tablename__ = "import_batches"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    source_type = Column(String(32), nullable=False)  # 'global_glossary' | 'game_glossary'
    game_id = Column(BigInteger, ForeignKey("games.id"), nullable=True)  # Chỉ khi source_type = game_glossary
    filename = Column(String(255), nullable=False)
    total_rows = Column(Integer, default=0)
    created_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "source_type": self.source_type,
            "game_id": self.game_id,
            "filename": self.filename,
            "total_rows": self.total_rows,
            "created_count": self.created_count,
            "error_count": self.error_count,
            "user_id": self.user_id,
            "created_at": self.created_at,
        }
