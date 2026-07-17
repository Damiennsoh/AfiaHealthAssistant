"""
AFIA Health Assistant — Clinics API
Multi-tenant clinic management
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.api.deps import require_super_admin, require_clinic_admin, get_current_active_user
from app.models.user import User, UserRole
from app.schemas.clinic import ClinicCreate, ClinicUpdate, ClinicResponse, SubscriptionUpdate, PublicClinicResponse
from app.models.clinic import Clinic

router = APIRouter()


@router.get("/public", response_model=List[PublicClinicResponse])
async def list_public_clinics(
    country_code: Optional[str] = Query(None, min_length=2, max_length=2, pattern=r"^[A-Z]{2}$"),
    search: Optional[str] = Query(None, min_length=1, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    """Public/unauthenticated endpoint to list active clinics for login step 1.
    
    Filter by country code and/or search by name or code.
    """
    query = select(Clinic).where(and_(Clinic.is_active == True, Clinic.is_deleted == False))
    
    if country_code:
        query = query.where(Clinic.country_code == country_code.upper())
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Clinic.name.ilike(search_term)) | 
            (Clinic.code.ilike(search_term))
        )
    
    result = await db.execute(query)
    clinics = result.scalars().all()
    
    return [PublicClinicResponse.model_validate(clinic) for clinic in clinics]


@router.get("/public/{clinic_code}", response_model=PublicClinicResponse)
async def get_public_clinic_by_code(
    clinic_code: str,
    db: AsyncSession = Depends(get_db),
):
    """Public/unauthenticated endpoint to get a clinic by its code."""
    result = await db.execute(select(Clinic).where(and_(Clinic.code == clinic_code.upper(), Clinic.is_active == True, Clinic.is_deleted == False)))
    clinic = result.scalar_one_or_none()
    
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found or inactive")
    
    return PublicClinicResponse.model_validate(clinic)


@router.get("/", response_model=List[ClinicResponse])
async def list_clinics(
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all clinics (super_admin only)."""
    from sqlalchemy import select, func
    from app.models.clinic import Clinic
    from app.models.patient import Patient

    result = await db.execute(select(Clinic).where(Clinic.is_deleted == False))
    clinics = result.scalars().all()

    # Add counts
    responses = []
    for clinic in clinics:
        user_count = await db.execute(select(func.count()).select_from(User).where(User.clinic_id == clinic.id))
        patient_count = await db.execute(select(func.count()).select_from(Patient).where(Patient.clinic_id == clinic.id))

        resp = ClinicResponse.model_validate(clinic)
        resp.user_count = user_count.scalar()
        resp.patient_count = patient_count.scalar()
        
        if clinic.admin_user_id:
            admin_user = await db.execute(select(User).where(User.id == clinic.admin_user_id))
            admin_user = admin_user.scalar_one_or_none()
            if admin_user:
                resp.admin_email = admin_user.email

        responses.append(resp)

    return responses


@router.post("/", response_model=ClinicResponse)
async def create_clinic(
    data: ClinicCreate,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create clinic with admin user (super_admin only)."""
    from app.models.clinic import Clinic, SubscriptionStatus, SubscriptionTier
    from app.models.user import User
    from app.core.security import get_password_hash

    # Create clinic
    # Subscription tier disabled for now - will be implemented later
    from app.models.clinic import SubscriptionTier
    clinic = Clinic(
        name=data.name,
        code=data.code.upper(),
        country_code=data.country_code.upper(),
        region=data.region,
        district=data.district,
        address=data.address,
        phone=data.phone,
        email=data.email,
        tier=SubscriptionTier.BASIC,  # Default tier since field is disabled
        status=SubscriptionStatus.TRIAL,
        trial_ends_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc) + __import__("datetime").timedelta(days=30),
        require_staff_id=data.require_staff_id,
        require_department=data.require_department,
    )
    db.add(clinic)
    await db.flush()

    # Create admin user
    admin = User(
        email=data.admin_email,
        name=data.admin_name,
        role=UserRole.CLINIC_ADMIN,
        clinic_id=clinic.id,
        hashed_password=get_password_hash(data.admin_temp_password),
        is_active=True,
        staff_id=data.admin_staff_id if data.require_staff_id else None,
        department=data.admin_department if data.require_department else None,
    )
    db.add(admin)
    await db.flush()

    clinic.admin_user_id = admin.id
    await db.commit()

    return ClinicResponse.model_validate(clinic)


@router.get("/{clinic_id}", response_model=ClinicResponse)
async def get_clinic(
    clinic_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get clinic by ID."""
    from sqlalchemy import select
    from app.models.clinic import Clinic

    if current_user.role != UserRole.SUPER_ADMIN and current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Cannot access other clinics")

    result = await db.execute(select(Clinic).where(and_(Clinic.id == clinic_id, Clinic.is_deleted == False)))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    resp = ClinicResponse.model_validate(clinic)
    
    from app.models.user import User
    if clinic.admin_user_id:
        admin_user = await db.execute(select(User).where(User.id == clinic.admin_user_id))
        admin_user = admin_user.scalar_one_or_none()
        if admin_user:
            resp.admin_email = admin_user.email
            
    return resp


@router.put("/{clinic_id}", response_model=ClinicResponse)
async def update_clinic(
    clinic_id: UUID,
    data: ClinicUpdate,
    current_user: User = Depends(require_clinic_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update clinic."""
    from sqlalchemy import select
    from app.models.clinic import Clinic
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction

    if current_user.role == UserRole.CLINIC_ADMIN and current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Cannot update other clinics")

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Track changes for audit log
    changes = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        old_value = getattr(clinic, field)
        if old_value != value:
            changes[field] = {"old": old_value, "new": value}
        setattr(clinic, field, value)

    await db.commit()

    # Log clinic update if there were changes
    if changes:
        audit_service = AuditService(db)
        await audit_service.log(
            action=AuditAction.CLINIC_UPDATED,
            user=current_user,
            clinic=clinic,
            resource_type="clinic",
            resource_id=str(clinic.id),
            details={"changes": changes}
        )

    return ClinicResponse.model_validate(clinic)


@router.post("/{clinic_id}/suspend", response_model=ClinicResponse)
async def suspend_clinic(
    clinic_id: UUID,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend clinic (reversible by superadmin)."""
    from sqlalchemy import select
    from app.models.clinic import Clinic
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.suspend(current_user.id)
    await db.commit()

    # Log suspension
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.CLINIC_SUSPENDED,
        user=current_user,
        clinic=clinic,
        resource_type="clinic",
        resource_id=str(clinic.id),
        details={"suspended_by": current_user.email}
    )

    return ClinicResponse.model_validate(clinic)


@router.post("/{clinic_id}/unsuspend", response_model=ClinicResponse)
async def unsuspend_clinic(
    clinic_id: UUID,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Unsuspend clinic (reactivate)."""
    from sqlalchemy import select
    from app.models.clinic import Clinic
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.unsuspend()
    await db.commit()

    # Log unsuspension
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.CLINIC_UNSUSPENDED,
        user=current_user,
        clinic=clinic,
        resource_type="clinic",
        resource_id=str(clinic.id),
        details={"unsuspended_by": current_user.email}
    )

    return ClinicResponse.model_validate(clinic)


@router.post("/{clinic_id}/archive", response_model=ClinicResponse)
async def archive_clinic(
    clinic_id: UUID,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Archive clinic (soft delete)."""
    from sqlalchemy import select
    from app.models.clinic import Clinic
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.archive(current_user.id)
    await db.commit()

    # Log archival
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.CLINIC_ARCHIVED,
        user=current_user,
        clinic=clinic,
        resource_type="clinic",
        resource_id=str(clinic.id),
        details={"archived_by": current_user.email}
    )

    return ClinicResponse.model_validate(clinic)


@router.delete("/{clinic_id}")
async def delete_clinic(
    clinic_id: UUID,
    current_user: User = Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """Hard-delete a clinic (super_admin only). The AFIA Administration clinic cannot be deleted."""
    from sqlalchemy import select
    from app.models.clinic import Clinic
    from app.services.audit_service import AuditService
    from app.models.audit import AuditAction

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Protect the global administration clinic from deletion
    if clinic.code == "ADMIN-001" or current_user.clinic_id == clinic_id:
        raise HTTPException(
            status_code=403,
            detail="The AFIA Administration account cannot be deleted."
        )

    # Log deletion before soft-deleting
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.CLINIC_DELETED,
        user=current_user,
        clinic=clinic,
        resource_type="clinic",
        resource_id=str(clinic.id),
        details={"deleted_by": current_user.email, "clinic_name": clinic.name, "was_demo_clinic": clinic.is_demo_clinic}
    )

    # Soft delete: hide the clinic from all queries without destroying any rows.
    # This prevents circular FK constraint violations and preserves audit history.
    clinic.soft_delete()
    await db.commit()

    return {"message": "Clinic deleted successfully"}
