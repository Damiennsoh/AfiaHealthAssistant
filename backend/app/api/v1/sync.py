"""
AFIA Health Assistant — Sync API
Offline-first sync protocol
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_active_user
from app.models.user import User
from app.schemas.sync import SyncPushRequest, SyncPullResponse, SyncResult, SyncAckRequest
from app.services.sync_service import SyncService

router = APIRouter()


@router.post("/push", response_model=List[SyncResult])
async def push_changes(
    request: SyncPushRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Push offline changes to server."""
    service = SyncService(db)
    return await service.push_changes(request, current_user)


@router.get("/pull")
async def pull_changes(
    device_id: str,
    last_sync_at: str = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Pull changes from server."""
    from datetime import datetime
    service = SyncService(db)

    parsed_sync_at = None
    if last_sync_at:
        parsed_sync_at = datetime.fromisoformat(last_sync_at.replace("Z", "+00:00"))

    return await service.pull_changes(device_id, current_user, parsed_sync_at)


@router.post("/ack")
async def acknowledge_sync(
    request: SyncAckRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Acknowledge received sync items."""
    return {"success": True}
