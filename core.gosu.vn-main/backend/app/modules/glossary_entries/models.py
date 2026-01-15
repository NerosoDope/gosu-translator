"""
Glossary_Entries Models - SQLAlchemy models

Author: GOSU Development Team
Version: 1.0.0
"""

from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.db.base import Base


class Glossary_Entries(Base):
    """Glossary_Entries Model"""
    __tablename__ = "glossary_entriess"
    
    id = Column(BigInteger, primary_key=True, index=True)
    # TODO: Add fields
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Glossary_Entries(id={self.id}, name={self.name})>"
    
    def to_dict(self):
        """Convert to dict"""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
