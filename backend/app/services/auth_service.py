"""
AFIA Health Assistant — Authentication Service
Admin-provisioned accounts ONLY. No self-registration.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload

from app.core.security import (
    verify_password, get_password_hash, create_access_token, create_refresh_token,
    validate_password_policy, generate_secure_token, decode_token
)
from app.core.exceptions import AuthenticationError, AccountLockedError, AuthorizationError
from app.core.logging import security_logger, audit_logger
from app.models.user import User, UserRole, PasswordHistory
from app.models.clinic import Clinic
from app.schemas.user import LoginRequest, TokenResponse, UserResponse


class AuthService:
    """Handle authentication, tokens, and account security."""

    MAX_FAILED_ATTEMPTS = 5
    LOCKOUT_DURATION_MINUTES = 30
    PASSWORD_HISTORY_LIMIT = 5

    def __init__(self, db: AsyncSession):
        self.db = db

    async def authenticate(self, login_data: LoginRequest) -> TokenResponse:
        """Authenticate user and return JWT tokens.

        NO self-registration. Accounts must be created by admin.
        Validates clinic, staff_id, and department as required by the clinic.
        """
        # First validate the clinic exists and is active (skip for super_admin)
        clinic = None
        if login_data.clinic_id:
            clinic_result = await self.db.execute(
                select(Clinic).where(and_(Clinic.id == login_data.clinic_id, Clinic.is_active == True))
            )
            clinic = clinic_result.scalar_one_or_none()
            
            if not clinic:
                security_logger.warning("Login failed: invalid clinic", clinic_id=str(login_data.clinic_id))
                raise AuthenticationError("Invalid credentials")
        
        # Find user by email
        # Super admins can login without being tied to a specific clinic
        if login_data.role == UserRole.SUPER_ADMIN:
            result = await self.db.execute(
                select(User)
                .options(joinedload(User.clinic))
                .where(and_(
                    User.email == login_data.email, 
                    User.is_active == True,
                    User.role == UserRole.SUPER_ADMIN
                ))
            )
        else:
            # Regular users must belong to the selected clinic
            result = await self.db.execute(
                select(User)
                .options(joinedload(User.clinic))
                .where(and_(
                    User.email == login_data.email, 
                    User.is_active == True,
                    User.clinic_id == login_data.clinic_id
                ))
            )
        user = result.scalar_one_or_none()

        if not user:
            security_logger.warning(
                "Login failed: user not found or not in clinic", 
                email=login_data.email,
                clinic_id=str(login_data.clinic_id)
            )
            raise AuthenticationError("Invalid credentials")
        
        # Validate staff_id if required by the clinic (only for non-super_admin users)
        if clinic and clinic.require_staff_id:
            if not login_data.staff_id:
                security_logger.warning(
                    "Login failed: staff_id required",
                    email=login_data.email,
                    clinic_id=str(login_data.clinic_id)
                )
                raise AuthenticationError("Staff ID is required for this clinic")
            
            if user.staff_id != login_data.staff_id:
                security_logger.warning(
                    "Login failed: staff_id mismatch",
                    email=login_data.email,
                    clinic_id=str(login_data.clinic_id)
                )
                raise AuthenticationError("Invalid credentials")
        
        # Validate department if required by the clinic (only for non-super_admin users)
        if clinic and clinic.require_department:
            if not login_data.department:
                security_logger.warning(
                    "Login failed: department required",
                    email=login_data.email,
                    clinic_id=str(login_data.clinic_id)
                )
                raise AuthenticationError("Department is required for this clinic")
            
            if user.department != login_data.department:
                security_logger.warning(
                    "Login failed: department mismatch",
                    email=login_data.email,
                    clinic_id=str(login_data.clinic_id)
                )
                raise AuthenticationError("Invalid credentials")

        # Check if account is locked
        if user.is_locked():
            security_logger.warning(
                "Login failed: account locked",
                user_id=str(user.id),
                locked_until=user.locked_until.isoformat()
            )
            raise AccountLockedError(f"Account locked until {user.locked_until}")

        # Verify password
        if not verify_password(login_data.password, user.hashed_password):
            # Increment failed attempts
            user.failed_login_attempts += 1

            if user.failed_login_attempts >= self.MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=self.LOCKOUT_DURATION_MINUTES)
                security_logger.warning(
                    "Account locked due to failed attempts",
                    user_id=str(user.id),
                    attempts=user.failed_login_attempts
                )

            await self.db.commit()
            raise AuthenticationError("Invalid credentials")

        # Success — reset failed attempts and update last login
        user.failed_login_attempts = 0
        user.locked_until = None
        user.last_login = datetime.now(timezone.utc)
        if login_data.device_fingerprint:
            user.device_fingerprint = login_data.device_fingerprint

        await self.db.commit()

        # Generate tokens with clinic context
        country_code = user.clinic.country_code if user.clinic else "GH"
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "clinic_id": str(user.clinic_id) if user.clinic_id else None,
            "country_code": country_code,
        }

        access_token = create_access_token(token_data)
        refresh_token = create_refresh_token({"sub": str(user.id)})

        security_logger.info(
            "User authenticated",
            user_id=str(user.id),
            clinic_id=str(user.clinic_id) if user.clinic_id else None,
            role=user.role.value
        )

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type="bearer",
            expires_in=480,  # 8 hours
            user=UserResponse(
                id=user.id,
                email=user.email,
                name=user.name,
                phone=user.phone,
                role=user.role,
                is_active=user.is_active,
                clinic_id=user.clinic_id,
                country_code=country_code,
                staff_id=user.staff_id,
                department=user.department,
                last_login=user.last_login,
                is_verified=user.is_verified,
                created_at=user.created_at,
                permissions=["*"] if user.can("*") else []
            )
        )

    async def refresh_access_token(self, refresh_token: str) -> str:
        """Refresh access token using refresh token."""
        payload = decode_token(refresh_token)
        if not payload or payload.get("type") != "refresh":
            raise AuthenticationError("Invalid refresh token")

        user_id = payload.get("sub")
        result = await self.db.execute(
            select(User)
            .options(joinedload(User.clinic))
            .where(User.id == UUID(user_id))
        )
        user = result.scalar_one_or_none()

        if not user or not user.is_active:
            raise AuthenticationError("User not found or inactive")

        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "clinic_id": str(user.clinic_id),
            "country_code": user.clinic.country_code if user.clinic else "GH",
        }

        return create_access_token(token_data)

    async def change_password(self, user_id: UUID, current_password: str, new_password: str) -> bool:
        """Change user password with policy validation and history check."""
        # Validate new password
        is_valid, error = validate_password_policy(new_password)
        if not is_valid:
            raise AuthenticationError(error)

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise AuthenticationError("User not found")

        # Verify current password
        if not verify_password(current_password, user.hashed_password):
            raise AuthenticationError("Current password is incorrect")

        # Check password history (last 5 passwords)
        history_result = await self.db.execute(
            select(PasswordHistory)
            .where(PasswordHistory.user_id == user_id)
            .order_by(PasswordHistory.created_at.desc())
            .limit(self.PASSWORD_HISTORY_LIMIT)
        )
        history = history_result.scalars().all()

        for old in history:
            if verify_password(new_password, old.hashed_password):
                raise AuthenticationError("Cannot reuse a recent password")

        # Hash and update
        new_hash = get_password_hash(new_password)

        # Save old password to history
        history_entry = PasswordHistory(user_id=user_id, hashed_password=user.hashed_password)
        self.db.add(history_entry)

        user.hashed_password = new_hash
        user.password_changed_at = datetime.now(timezone.utc)

        await self.db.commit()

        security_logger.info("Password changed", user_id=str(user_id))
        return True

    async def admin_reset_password(self, admin_user: User, target_user_id: UUID, new_password: str) -> bool:
        """Admin resets another user's password."""
        # Verify admin has permission
        if admin_user.role not in [UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN]:
            raise AuthorizationError("Only admins can reset passwords")

        result = await self.db.execute(select(User).where(User.id == target_user_id))
        target = result.scalar_one_or_none()

        if not target:
            raise AuthenticationError("User not found")

        # Clinic admin can only reset users in their clinic
        if admin_user.role == UserRole.CLINIC_ADMIN and target.clinic_id != admin_user.clinic_id:
            raise AuthorizationError("Cannot reset password for users outside your clinic")

        is_valid, error = validate_password_policy(new_password)
        if not is_valid:
            raise AuthenticationError(error)

        # Save to history
        history_entry = PasswordHistory(user_id=target_user_id, hashed_password=target.hashed_password)
        self.db.add(history_entry)

        target.hashed_password = get_password_hash(new_password)
        target.failed_login_attempts = 0
        target.locked_until = None

        await self.db.commit()

        security_logger.info(
            "Password reset by admin",
            admin_id=str(admin_user.id),
            target_id=str(target_user_id)
        )
        return True

    async def verify_token(self, token: str) -> Optional[dict]:
        """Verify access token and return payload."""
        payload = decode_token(token)
        if not payload or payload.get("type") != "access":
            return None

        # Check if user still exists and is active
        user_id = payload.get("sub")
        result = await self.db.execute(
            select(User)
            .options(joinedload(User.clinic))
            .where(and_(User.id == UUID(user_id), User.is_active == True))
        )
        user = result.scalar_one_or_none()

        if not user:
            return None

        return {
            "user_id": user.id,
            "email": user.email,
            "role": user.role,
            "clinic_id": user.clinic_id,
            "country_code": user.clinic.country_code if user.clinic else "GH",
        }
