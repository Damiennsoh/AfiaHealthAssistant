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
    query = select(Clinic).where(Clinic.is_active == True)
    
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
    result = await db.execute(select(Clinic).where(and_(Clinic.code == clinic_code.upper(), Clinic.is_active == True)))
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

    result = await db.execute(select(Clinic))
    clinics = result.scalars().all()

    # Add counts
    responses = []
    for clinic in clinics:
        user_count = await db.execute(select(func.count()).select_from(User).where(User.clinic_id == clinic.id))
        patient_count = await db.execute(select(func.count()).select_from("patients").where("patients.clinic_id" == clinic.id))

        resp = ClinicResponse.model_validate(clinic)
        resp.user_count = user_count.scalar()
        resp.patient_count = patient_count.scalar()
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
    clinic = Clinic(
        name=data.name,
        code=data.code.upper(),
        country_code=data.country_code.upper(),
        region=data.region,
        district=data.district,
        address=data.address,
        phone=data.phone,
        email=data.email,
        tier=data.tier,
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
    )
    db.add(admin)

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

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    return ClinicResponse.model_validate(clinic)


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

    if current_user.role == UserRole.CLINIC_ADMIN and current_user.clinic_id != clinic_id:
        raise HTTPException(status_code=403, detail="Cannot update other clinics")

    result = await db.execute(select(Clinic).where(Clinic.id == clinic_id))
    clinic = result.scalar_one_or_none()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(clinic, field, value)

    await db.commit()
    return ClinicResponse.model_validate(clinic)
