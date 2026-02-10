"""
Global_Glossary Models - SQLAlchemy models

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Global_Glossary(Base):
    """Global_Glossary Model"""
    __tablename__ = "global_glossary"
    
    id = Column(BigInteger, primary_key=True, index=True)
    term = Column(String(255), nullable=False)
    translated_term = Column(String(255), nullable=False)
    language_pair = Column(String(255), nullable=False)
    game_category_id = Column(Integer, ForeignKey("game_category.id"), nullable=True)
    usage_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    game_category = relationship("GameCategory")
    
    def __repr__(self):
        return f"<Global_Glossary(id={self.id}, term={self.term})>"
    
    def to_dict(self):
        """Convert to dict"""
        return {
            "id": self.id,
            "term": self.term,
            "translated_term": self.translated_term,
            "language_pair": self.language_pair,
            "game_category_id": self.game_category_id,
            "usage_count": self.usage_count,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
