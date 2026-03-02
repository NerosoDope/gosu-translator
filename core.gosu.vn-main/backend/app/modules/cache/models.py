from sqlalchemy import Column, Integer, String, Text, DateTime, BigInteger
from sqlalchemy.sql import func
from app.db.base import Base

class Cache(Base):
    __tablename__ = "cache"
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=False)
    source_text = Column(Text, nullable=True)  # nội dung gốc (để hiển thị trong xem chi tiết)
    ttl = Column(BigInteger, nullable=True, server_default="86400")  # TTL tính bằng giây, mặc định 1 ngày
    origin = Column(String(50), nullable=True, index=True)  # direct | file | proofread
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
