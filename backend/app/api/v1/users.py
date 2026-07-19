"""
AFIA Health Assistant — Users API
Admin-provisioned CRUD. No self-registration.
"""
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, Body, HTTPException
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
    """Create new user (admin only) with audit logging."""
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction
    from sqlalchemy import select
    from app.models.clinic import Clinic

    service = UserService(db)
    new_user, temp_password = await service.create_user(current_user, user_data)

    # Get clinic for audit context
    clinic = None
    if new_user.clinic_id:
        result = await db.execute(select(Clinic).where(Clinic.id == new_user.clinic_id))
        clinic = result.scalar_one_or_none()

    # Log user creation with AuditService
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.USER_CREATED,
        user=current_user,
        clinic=clinic,
        resource_type="user",
        resource_id=str(new_user.id),
        details={
            "created_by": current_user.email,
            "new_user_email": new_user.email,
            "new_user_name": new_user.name,
            "new_user_role": new_user.role.value if new_user.role else None,
            "new_user_staff_id": new_user.staff_id,
            "new_user_department": new_user.department
        }
    )

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
    """Update user with audit logging."""
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction
    from sqlalchemy import select
    from app.models.clinic import Clinic

    service = UserService(db)
    user = await service.update_user(user_id, update_data, current_user)

    # Get clinic for audit context
    clinic = None
    if user.clinic_id:
        result = await db.execute(select(Clinic).where(Clinic.id == user.clinic_id))
        clinic = result.scalar_one_or_none()

    # Log user update with AuditService
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.USER_UPDATED,
        user=current_user,
        clinic=clinic,
        resource_type="user",
        resource_id=str(user.id),
        details={
            "updated_by": current_user.email,
            "updated_user_email": user.email,
            "updated_user_name": user.name,
            "updated_user_role": user.role.value if user.role else None,
            "changes": update_data.model_dump(exclude_unset=True)
        }
    )

    return UserResponse.model_validate(user)


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    delete_data: dict = Body(default=None),
    current_user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete user (soft delete) with compliance reason and audit logging."""
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction
    from sqlalchemy import select
    from app.models.clinic import Clinic

    reason = None
    if delete_data and "reason" in delete_data:
        reason = delete_data.get("reason")

    # Get user and clinic before deletion for audit context
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    clinic = None
    if user.clinic_id:
        clinic_result = await db.execute(select(Clinic).where(Clinic.id == user.clinic_id))
        clinic = clinic_result.scalar_one_or_none()

    service = UserService(db)
    await service.delete_user(user_id, current_user, reason)

    # Log user deletion with AuditService
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.USER_DELETED,
        user=current_user,
        clinic=clinic,
        resource_type="user",
        resource_id=str(user_id),
        details={
            "deleted_by": current_user.email,
            "deleted_user_email": user.email,
            "deleted_user_name": user.name,
            "deleted_user_role": user.role.value if user.role else None,
            "reason": reason
        }
    )

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


@router.put("/me/profile")
async def update_own_profile(
    profile_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update own profile (clinic admin only).
    Allows updating: name, email, phone, and clinic details (name, email, phone).
    All changes are recorded in the audit log.
    """
    if current_user.role != UserRole.CLINIC_ADMIN:
        raise HTTPException(status_code=403, detail="Only clinic admins can update their profile")
    
    from sqlalchemy import select
    from app.models.clinic import Clinic
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction

    # --- Track and apply user-level changes ---
    user_changes = {}
    if "email" in profile_data and current_user.email != profile_data["email"]:
        user_changes["email"] = {"old": current_user.email, "new": profile_data["email"]}
        current_user.email = profile_data["email"]
    if "phone" in profile_data and current_user.phone != profile_data["phone"]:
        user_changes["phone"] = {"old": current_user.phone, "new": profile_data["phone"]}
        current_user.phone = profile_data["phone"]
    if "name" in profile_data and current_user.name != profile_data["name"]:
        user_changes["name"] = {"old": current_user.name, "new": profile_data["name"]}
        current_user.name = profile_data["name"]

    # --- Track and apply clinic-level changes ---
    clinic_changes = {}
    if current_user.clinic_id:
        result = await db.execute(select(Clinic).where(Clinic.id == current_user.clinic_id))
        clinic = result.scalar_one_or_none()
        if clinic:
            if "clinic_name" in profile_data and clinic.name != profile_data["clinic_name"]:
                clinic_changes["name"] = {"old": clinic.name, "new": profile_data["clinic_name"]}
                clinic.name = profile_data["clinic_name"]
            if "clinic_email" in profile_data and clinic.email != profile_data["clinic_email"]:
                clinic_changes["email"] = {"old": clinic.email, "new": profile_data["clinic_email"]}
                clinic.email = profile_data["clinic_email"]
            if "clinic_phone" in profile_data and clinic.phone != profile_data["clinic_phone"]:
                clinic_changes["phone"] = {"old": clinic.phone, "new": profile_data["clinic_phone"]}
                clinic.phone = profile_data["clinic_phone"]
            if "clinic_region" in profile_data and clinic.region != profile_data["clinic_region"]:
                clinic_changes["region"] = {"old": clinic.region, "new": profile_data["clinic_region"]}
                clinic.region = profile_data["clinic_region"]
            if "clinic_district" in profile_data and clinic.district != profile_data["clinic_district"]:
                clinic_changes["district"] = {"old": clinic.district, "new": profile_data["clinic_district"]}
                clinic.district = profile_data["clinic_district"]
            if "clinic_address" in profile_data and clinic.address != profile_data["clinic_address"]:
                clinic_changes["address"] = {"old": clinic.address, "new": profile_data["clinic_address"]}
                clinic.address = profile_data["clinic_address"]

    await db.commit()
    await db.refresh(current_user)

    audit_service = AuditService(db)

    # Log user profile changes
    if user_changes:
        await audit_service.log(
            action=AuditAction.USER_PROFILE_UPDATED,
            user=current_user,
            clinic=clinic if current_user.clinic_id else None,
            resource_type="user",
            resource_id=str(current_user.id),
            details={"changes": user_changes, "updated_by": current_user.email}
        )

    # Log clinic changes
    if clinic_changes and current_user.clinic_id:
        await audit_service.log(
            action=AuditAction.CLINIC_UPDATED,
            user=current_user,
            clinic=clinic,
            resource_type="clinic",
            resource_id=str(clinic.id),
            details={"changes": clinic_changes, "updated_by": current_user.email}
        )

    return {"success": True, "message": "Profile updated successfully"}


@router.post("/clinics/{clinic_id}/reset-admin-password")
async def reset_clinic_admin_password(
    clinic_id: UUID,
    data: PasswordResetRequest,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Reset a clinic's admin user password (super_admin only).
    Looks up the clinic's admin_user_id and resets their password.
    Records the action in the audit log.
    """
    from sqlalchemy import select
    from app.models.clinic import Clinic
    from app.services.auth_service import AuthService
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    if not clinic.admin_user_id:
        raise HTTPException(status_code=404, detail="This clinic has no assigned admin user")

    auth_service = AuthService(db)
    await auth_service.admin_reset_password(current_user, clinic.admin_user_id, data.new_password)

    # Log the password reset
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.ADMIN_PASSWORD_RESET,
        user=current_user,
        clinic=clinic,
        resource_type="user",
        resource_id=str(clinic.admin_user_id),
        details={
            "reset_by": current_user.email,
            "clinic_name": clinic.name,
            "clinic_code": clinic.code,
        }
    )

    return {"success": True, "message": f"Admin password for clinic '{clinic.name}' has been reset."}

