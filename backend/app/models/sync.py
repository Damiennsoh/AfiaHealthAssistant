"""
AFIA Health Assistant — Sync Queue Model
Offline-first sync: queue changes when offline, push when online
"""
import uuid
from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class SyncStatus(str, PyEnum):
    """Sync queue item status."""
    PENDING = "pending"       # Queued locally, not yet pushed
    PUSHED = "pushed"         # Sent to server, awaiting confirmation
    ACKNOWLEDGED = "acknowledged"  # Server confirmed receipt
    FAILED = "failed"         # Push failed, will retry
    CONFLICT = "conflict"     # Server version newer, needs resolution


class SyncEntityType(str, PyEnum):
    """Types of entities that can be synced."""
    PATIENT = "patient"
    ENCOUNTER = "encounter"
    ENCOUNTER_UPDATE = "encounter_update"


class SyncQueue(BaseModel):
    """Offline sync queue — one row per pending change."""
    __tablename__ = "sync_queue"

    # Device/client that created this change
    device_id = Column(String(255), nullable=False, index=True)
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # What changed
    entity_type = Column(Enum(SyncEntityType), nullable=False)
    entity_offline_id = Column(String(100), nullable=False)  # Client-generated ID
    entity_server_id = Column(UUID(as_uuid=True), nullable=True)  # Assigned after first sync

    # The actual data
    payload = Column(JSONB, nullable=False)  # Full entity JSON
    payload_version = Column(Integer, default=1)  # For conflict detection

    # Sync state
    status = Column(Enum(SyncStatus), default=SyncStatus.PENDING)
    retry_count = Column(Integer, default=0)
    last_error = Column(Text, nullable=True)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)

    # Server-side
    server_acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    server_conflict_payload = Column(JSONB, nullable=True)  # Server version if conflict

    # Relationships
    clinic = relationship("Clinic")
    user = relationship("User")

    def is_retryable(self) -> bool:
        """Check if this item should be retried."""
        if self.status not in [SyncStatus.PENDING, SyncStatus.FAILED]:
            return False
        if self.retry_count >= 5:
            return False
        if self.last_attempt_at:
            # Wait at least 5 minutes between retries
            from datetime import timedelta
            return (datetime.now(timezone.utc) - self.last_attempt_at) > timedelta(minutes=5)
        return True
