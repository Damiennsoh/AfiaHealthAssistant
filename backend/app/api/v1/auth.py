"""
AFIA Health Assistant — Auth API
Login, refresh, password change. NO registration.
"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_active_user
from app.core.exceptions import AuthenticationError
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, PasswordChange, UserResponse
from app.services.auth_service import AuthService

router = APIRouter()


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/login", response_model=TokenResponse)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user and return JWT tokens.

    NO self-registration. Accounts are admin-provisioned only.
    """
    auth_service = AuthService(db)
    return await auth_service.authenticate(login_data)


@router.post("/refresh")
async def refresh_token(
    request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """Refresh access token."""
    auth_service = AuthService(db)
    new_token = await auth_service.refresh_access_token(request.refresh_token)
    return {"access_token": new_token, "token_type": "bearer"}


@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Change own password."""
    auth_service = AuthService(db)
    success = await auth_service.change_password(
        current_user.id, data.current_password, data.new_password
    )
    return {"success": success}


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
):
    """Get current user info."""
    country_code = current_user.clinic.country_code if current_user.clinic else "GH"
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        phone=current_user.phone,
        role=current_user.role,
        is_active=current_user.is_active,
        clinic_id=current_user.clinic_id,
        country_code=country_code,
        staff_id=current_user.staff_id,
        department=current_user.department,
        last_login=current_user.last_login,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at,
        permissions=["*"] if current_user.can("*") else []
    )
