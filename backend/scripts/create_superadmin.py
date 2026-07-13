#!/usr/bin/env python3
"""
AFIA Health Assistant — Create Super Admin

Usage:
    python scripts/create_superadmin.py --email admin@yourorg.com --name "Admin" --password "SecurePass123!"
"""
import argparse
import asyncio
from pathlib import Path

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.clinic import Clinic
from app.core.security import get_password_hash


async def create_superadmin(email: str, name: str, password: str):
    """Create initial super admin account."""
    async with AsyncSessionLocal() as db:
        # Check if super admin already exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Super admin already exists: {existing.email}")
            return

        # Create super admin WITHOUT a clinic (global access)
        super_admin = User(
            email=email,
            name=name,
            role=UserRole.SUPER_ADMIN,
            clinic_id=None,  # Super admin is global, no clinic assignment
            hashed_password=get_password_hash(password),
            is_active=True,
            is_verified=True,
        )
        db.add(super_admin)

        await db.commit()
        print(f"Super admin created: {email}")
        print("Super admin has global access (no clinic assignment)")
        print("You can now log in and create clinics.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    asyncio.run(create_superadmin(args.email, args.name, args.password))


if __name__ == "__main__":
    main()
