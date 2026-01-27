"""
Game Models - SQLAlchemy models

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base


class Game(Base):
    """Game Model"""
    __tablename__ = "games"
    
    id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    game_category_id = Column(Integer, ForeignKey('game_category.id'), nullable=False)
    is_active = Column(Boolean, default=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Game(id={self.id}, name={self.name})>"
    
    def to_dict(self):
        """Convert to dict"""
        return {
            "id": self.id,
            "name": self.name,
            "game_category_id": self.game_category_id,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
