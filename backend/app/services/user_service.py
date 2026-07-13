"""
AFIA Health Assistant — User Service
Admin-provisioned CRUD. No self-registration.
"""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.security import get_password_hash, validate_password_policy, generate_secure_token
from app.core.exceptions import (
    AuthorizationError, DuplicateResourceError, AuthenticationError
)
from app.core.logging import audit_logger
from app.models.user import User, UserRole, PasswordHistory
from app.models.clinic import Clinic
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PasswordResetRequest


class UserService:
    """Manage user accounts (admin only)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, creator: User, user_data: UserCreate) -> User:
        """Create a new user account (admin-provisioned only).

        NO self-registration. Only super_admin or clinic_admin can create users.
        """
        # Verify creator has permission
        if creator.role not in [UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN]:
            raise AuthorizationError("Only admins can create user accounts")

        # Clinic admin can only create users for their clinic
        if creator.role == UserRole.CLINIC_ADMIN and creator.clinic_id != user_data.clinic_id:
            raise AuthorizationError("Cannot create users for other clinics")

        # Verify clinic exists
        clinic_result = await self.db.execute(select(Clinic).where(Clinic.id == user_data.clinic_id))
        clinic = clinic_result.scalar_one_or_none()
        if not clinic:
            raise AuthorizationError("Clinic not found")

        # Check clinic user limit
        count_result = await self.db.execute(
            select(func.count(User.id)).where(User.clinic_id == user_data.clinic_id)
        )
        user_count = count_result.scalar()
        if user_count >= clinic.max_users:
            raise AuthorizationError(f"Clinic user limit reached ({clinic.max_users})")

        # Check email uniqueness
        existing = await self.db.execute(select(User).where(User.email == user_data.email))
        if existing.scalar_one_or_none():
            raise DuplicateResourceError(f"User with email {user_data.email} already exists")

        # Generate temp password if not provided
        temp_password = user_data.temp_password or generate_secure_token(16)
        is_valid, error = validate_password_policy(temp_password)
        if not is_valid:
            temp_password = generate_secure_token(20)  # Ensure it meets policy

        # Create user
        new_user = User(
            email=user_data.email,
            name=user_data.name,
            phone=user_data.phone,
            staff_id=user_data.staff_id,
            department=user_data.department,
            role=user_data.role,
            clinic_id=user_data.clinic_id,
            hashed_password=get_password_hash(temp_password),
            is_active=True,
            is_verified=False,  # Must verify email or change password on first login
        )

        self.db.add(new_user)
        await self.db.flush()  # Get ID without committing

        # Log audit
        audit_logger.info(
            "User created",
            action="user_created",
            creator_id=str(creator.id),
            new_user_id=str(new_user.id),
            clinic_id=str(user_data.clinic_id),
            role=user_data.role.value
        )

        await self.db.commit()

        # Return user + temp password (admin must communicate this securely)
        return new_user, temp_password

    async def get_users_by_clinic(self, clinic_id: UUID, requesting_user: User) -> List[User]:
        """Get all users in a clinic."""
        if requesting_user.role == UserRole.CLINIC_ADMIN and requesting_user.clinic_id != clinic_id:
            raise AuthorizationError("Cannot view users from other clinics")

        result = await self.db.execute(
            select(User).where(and_(User.clinic_id == clinic_id, User.is_active == True))
        )
        return result.scalars().all()

    async def get_user(self, user_id: UUID, requesting_user: User) -> User:
        """Get user by ID."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise AuthorizationError("User not found")

        # Clinic admin can only view their clinic's users
        if requesting_user.role == UserRole.CLINIC_ADMIN and user.clinic_id != requesting_user.clinic_id:
            raise AuthorizationError("Cannot view users from other clinics")

        return user

    async def update_user(self, user_id: UUID, update_data: UserUpdate, requesting_user: User) -> User:
        """Update user (admin or self)."""
        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise AuthorizationError("User not found")

        # Self can update name/phone only
        if requesting_user.id == user_id:
            if update_data.role is not None or update_data.is_active is not None:
                raise AuthorizationError("Cannot change your own role or status")
        else:
            # Admin checks
            if requesting_user.role not in [UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN]:
                raise AuthorizationError("Cannot update other users")
            if requesting_user.role == UserRole.CLINIC_ADMIN and user.clinic_id != requesting_user.clinic_id:
                raise AuthorizationError("Cannot update users from other clinics")

        # Apply updates
        for field, value in update_data.model_dump(exclude_unset=True).items():
            setattr(user, field, value)

        user.updated_at = datetime.now(timezone.utc)

        audit_logger.info(
            "User updated",
            action="user_updated",
            updater_id=str(requesting_user.id),
            user_id=str(user_id),
            changes=update_data.model_dump(exclude_unset=True)
        )

        await self.db.commit()
        return user

    async def delete_user(self, user_id: UUID, requesting_user: User, reason: Optional[str] = None) -> bool:
        """Soft-delete user (admin only) with compliance reason."""
        if requesting_user.role not in [UserRole.SUPER_ADMIN, UserRole.CLINIC_ADMIN]:
            raise AuthorizationError("Only admins can delete users")

        result = await self.db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

        if not user:
            raise AuthorizationError("User not found")

        if requesting_user.role == UserRole.CLINIC_ADMIN and user.clinic_id != requesting_user.clinic_id:
            raise AuthorizationError("Cannot delete users from other clinics")

        # Cannot delete yourself
        if user.id == requesting_user.id:
            raise AuthorizationError("Cannot delete your own account")

        # Require reason for compliance
        if not reason or not reason.strip():
            raise AuthorizationError("A reason must be provided for user deletion")

        user.is_active = False
        user.updated_at = datetime.now(timezone.utc)

        audit_logger.info(
            "User deleted",
            action="user_deleted",
            deleter_id=str(requesting_user.id),
            deleter_email=requesting_user.email,
            deleter_role=requesting_user.role.value,
            user_id=str(user_id),
            user_email=user.email,
            user_name=user.name,
            user_role=user.role.value,
            clinic_id=str(user.clinic_id),
            reason=reason
        )

        await self.db.commit()
        return True
