from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base import Base

class GameGlossary(Base):
    __tablename__ = "game_glossary"
    id = Column(Integer, primary_key=True, index=True)
    term = Column(String(255), nullable=False)
    definition = Column(Text, nullable=False)
    category_id = Column(Integer, ForeignKey('game_category.id'), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
