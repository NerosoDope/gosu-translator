from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Language(Base):
    __tablename__ = "languages"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(16), unique=True, nullable=False)  # ISO 639-1 code (2 chars)
    name = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    is_deleted = Column(Boolean, default=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    source_pairs = relationship("LanguagePair", foreign_keys="LanguagePair.source_language_id", back_populates="source_language")
    target_pairs = relationship("LanguagePair", foreign_keys="LanguagePair.target_language_id", back_populates="target_language")

class LanguagePair(Base):
    __tablename__ = "language_pairs"
    id = Column(Integer, primary_key=True, index=True)
    source_language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    target_language_id = Column(Integer, ForeignKey("languages.id"), nullable=False)
    is_bidirectional = Column(Boolean, default=False)  # Allow translation in both directions
    is_active = Column(Boolean, default=True)
    organization_id = Column(Integer, nullable=True)  # For multi-tenant support, null = global
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    source_language = relationship("Language", foreign_keys=[source_language_id], back_populates="source_pairs")
    target_language = relationship("Language", foreign_keys=[target_language_id], back_populates="target_pairs")

    # Constraints
    __table_args__ = (
        # Prevent duplicate pairs (source->target must be unique)
        {"schema": None}
    )
