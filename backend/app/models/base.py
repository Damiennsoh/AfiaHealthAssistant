"""
AFIA Health Assistant — Base Model with UUID PK and timestamps
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

from app.db.session import Base


class BaseModel(Base):
    """Base model with UUID primary key and automatic timestamps."""
    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SoftDeleteMixin:
    """
    Reusable mixin that adds soft-delete capability to any SQLAlchemy model.
    Inherit from this alongside BaseModel for any table that should never
    permanently lose rows (patients, staff, devices, etc.)
    """
    is_deleted = Column(Boolean, default=False, nullable=False, server_default="false")

    def soft_delete(self) -> None:
        """Mark this record as soft-deleted (hidden from all queries)."""
        self.is_deleted = True
