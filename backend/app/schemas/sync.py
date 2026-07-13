"""
AFIA Health Assistant — Sync Schemas (Offline-First)
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.sync import SyncStatus, SyncEntityType


class SyncItem(BaseModel):
    """Single sync item from client."""
    offline_id: str = Field(..., description="Client-generated UUID")
    entity_type: SyncEntityType
    entity_server_id: Optional[UUID] = None  # Null for new entities
    payload: Dict[str, Any] = Field(..., description="Full entity JSON")
    payload_version: int = 1
    created_at: datetime  # Client timestamp


class SyncPushRequest(BaseModel):
    """Client pushes offline changes to server."""
    device_id: str = Field(..., description="Unique device identifier")
    items: List[SyncItem] = Field(default_factory=list)
    last_sync_at: Optional[datetime] = None  # Client's last successful sync


class SyncResult(BaseModel):
    """Result of processing a single sync item."""
    offline_id: str
    status: str  # acknowledged | conflict | failed
    server_id: Optional[UUID] = None  # Assigned or existing server ID
    error: Optional[str] = None
    server_version: Optional[int] = None  # For conflict detection
    server_payload: Optional[Dict[str, Any]] = None  # Server version if conflict


class SyncPullResponse(BaseModel):
    """Server sends changes back to client."""
    device_id: str
    server_time: datetime
    items: List[SyncItem] = Field(default_factory=list)  # Changes from other devices
    deleted_ids: List[str] = Field(default_factory=list)  # Entities deleted on server
    has_more: bool = False
    next_cursor: Optional[str] = None


class SyncAckRequest(BaseModel):
    """Client acknowledges received items."""
    device_id: str
    acknowledged_ids: List[str] = Field(default_factory=list)


class SyncConflict(BaseModel):
    """Conflict resolution data."""
    offline_id: str
    entity_type: SyncEntityType
    client_payload: Dict[str, Any]
    server_payload: Dict[str, Any]
    resolution: str = Field("server", description="server | client | merge")
    merged_payload: Optional[Dict[str, Any]] = None
