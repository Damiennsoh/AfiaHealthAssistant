"""
AFIA Health Assistant — Users API
Admin-provisioned CRUD. No self-registration.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import require_clinic_admin, require_super_admin, get_current_active_user
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PasswordResetRequest
from app.services.user_service import UserService

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
):
    """List users in current clinic."""
    service = UserService(db)
    users = await service.get_users_by_clinic(current_user.clinic_id, current_user)
    return [UserResponse.model_validate(u) for u in users]


@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create new user (admin only)."""
    service = UserService(db)
    new_user, temp_password = await service.create_user(current_user, user_data)
    # In production, send temp_password via SMS or secure channel
    return UserResponse.model_validate(new_user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get user by ID."""
    service = UserService(db)
    user = await service.get_user(user_id, current_user)
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    update_data: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user."""
    service = UserService(db)
    user = await service.update_user(user_id, update_data, current_user)
    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    delete_data: dict = Body(default=None),
    current_user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete user (soft delete) with compliance reason."""
    reason = None
    if delete_data and "reason" in delete_data:
        reason = delete_data.get("reason")
    
    service = UserService(db)
    await service.delete_user(user_id, current_user, reason)
    return {"success": True}


@router.post("/{user_id}/reset-password")
async def reset_password(
    user_id: UUID,
    data: PasswordResetRequest,
    current_user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin reset user password."""
    from app.services.auth_service import AuthService
    auth_service = AuthService(db)
    await auth_service.admin_reset_password(current_user, user_id, data.new_password)
    return {"success": True}
