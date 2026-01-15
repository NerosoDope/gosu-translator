"""
Job Models - SQLAlchemy models

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Text, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.db.base import Base


class Job(Base):
    """Job Model"""
    __tablename__ = "jobs"
    
    id = Column(BigInteger, primary_key=True, index=True)
    job_code = Column(String(50), unique=True, nullable=False)
    job_type = Column(String(50), nullable=False)
    status = Column(String(30), nullable=False)
    priority = Column(Integer, default=5)
    user_id = Column(BigInteger, nullable=False)
    team_id = Column(BigInteger, nullable=True)
    game_id = Column(BigInteger, nullable=True)
    game_genre = Column(String(50), nullable=True)
    source_lang = Column(String(10), nullable=True)
    target_lang = Column(String(10), nullable=True)
    progress = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    max_retry = Column(Integer, default=3)
    payload = Column(JSONB, nullable=True)
    result = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<Job(id={self.id}, job_code={self.job_code})>"
    
    def to_dict(self):
        """Convert to dict"""
        return {
            "id": self.id,
            "job_code": self.job_code,
            "job_type": self.job_type,
            "status": self.status,
            "priority": self.priority,
            "user_id": self.user_id,
            "team_id": self.team_id,
            "game_id": self.game_id,
            "game_genre": self.game_genre,
            "source_lang": self.source_lang,
            "target_lang": self.target_lang,
            "progress": self.progress,
            "retry_count": self.retry_count,
            "max_retry": self.max_retry,
            "payload": self.payload,
            "result": self.result,
            "error_message": self.error_message,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }
