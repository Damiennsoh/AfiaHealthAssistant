"""
AFIA Health Assistant — API Dependencies
Database session, current user, permissions
"""
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import decode_token
from app.core.exceptions import AuthenticationError, AuthorizationError
from app.models.user import User, UserRole
from app.services.auth_service import AuthService


security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get current user from JWT token."""
    if not credentials:
        raise AuthenticationError("No authentication provided")

    auth_service = AuthService(db)
    payload = await auth_service.verify_token(credentials.credentials)

    if not payload:
        raise AuthenticationError("Invalid or expired token")

    # Load full user
    from sqlalchemy import select
    from sqlalchemy.orm import joinedload
    result = await db.execute(select(User).options(joinedload(User.clinic)).where(User.id == payload["user_id"]))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive")

    # Attach request info for audit
    user._ip_address = request.client.host if request.client else None
    user._user_agent = request.headers.get("user-agent")

    return user


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Verify user is active."""
    if not current_user.is_active:
        raise AuthenticationError("Inactive user")
    return current_user


def require_role(roles: list[UserRole]):
    """Dependency factory for role-based access control."""
    async def role_checker(current_user: User = Depends(get_current_active_user)):
        if current_user.role not in roles:
            raise AuthorizationError(f"Required role: {[r.value for r in roles]}")
        return current_user
    return role_checker


# Convenience dependencies
require_super_admin = require_role([UserRole.SUPER_ADMIN])
require_clinic_admin = require_role([UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN])
require_healthworker = require_role([UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN, UserRole.HEALTHWORKER])
