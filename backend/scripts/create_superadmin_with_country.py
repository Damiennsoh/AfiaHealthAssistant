#!/usr/bin/env python3
"""
AFIA Health Assistant — Create Super Admin with Country Association

This script creates a super admin account that can manage clinics across all countries.
The country parameter determines which country's administration clinic the super admin
is initially associated with, but they will have global access.

Usage:
    python scripts/create_superadmin_with_country.py --email admin@yourorg.com --name "Admin" --password "SecurePass123!" --country ZW

Options:
    --email: Admin email address (required)
    --name: Admin full name (required)
    --password: Admin password (required)
    --country: Country code (GH or ZW, default: GH)
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


async def create_superadmin(email: str, name: str, password: str, country_code: str = "GH"):
    """Create initial super admin account with country association."""
    async with AsyncSessionLocal() as db:
        # Check if super admin already exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"Super admin already exists: {existing.email}")
            print("If you need to create another super admin, please delete the existing one first.")
            return

        # Determine clinic details based on country
        country_names = {
            "GH": "Ghana",
            "ZW": "Zimbabwe"
        }
        country_name = country_names.get(country_code.upper(), "Ghana")
        
        # Create a dummy administration clinic for super admin
        admin_clinic = Clinic(
            name=f"AFIA Administration - {country_name}",
            code=f"ADMIN-{country_code.upper()}-001",
            country_code=country_code.upper(),
            tier="enterprise",
            require_staff_id=False,
            require_department=False,
        )
        db.add(admin_clinic)
        await db.flush()

        # Create super admin
        super_admin = User(
            email=email,
            name=name,
            role=UserRole.SUPER_ADMIN,
            clinic_id=admin_clinic.id,
            hashed_password=get_password_hash(password),
            is_active=True,
            is_verified=True,
        )
        db.add(super_admin)

        admin_clinic.admin_user_id = super_admin.id

        await db.commit()
        print(f"✅ Super admin created successfully!")
        print(f"   Email: {email}")
        print(f"   Name: {name}")
        print(f"   Role: SUPER_ADMIN (Global Access)")
        print(f"   Associated Country: {country_name} ({country_code.upper()})")
        print(f"   Admin Clinic: {admin_clinic.name}")
        print(f"\n📝 Important Notes:")
        print(f"   - This super admin has GLOBAL access to ALL countries (GH and ZW)")
        print(f"   - You can now log in and create clinics in any country")
        print(f"   - Use the country-specific clinic creation scripts to add clinics:")
        print(f"     * python scripts/create-ghana-clinic.py")
        print(f"     * python scripts/create-zimbabwe-clinic.py")


def main():
    parser = argparse.ArgumentParser(description="Create a super admin with country association")
    parser.add_argument("--email", required=True, help="Admin email address")
    parser.add_argument("--name", required=True, help="Admin full name")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--country", default="GH", choices=["GH", "ZW"], 
                       help="Country code (GH or ZW, default: GH)")
    args = parser.parse_args()

    asyncio.run(create_superadmin(args.email, args.name, args.password, args.country))


if __name__ == "__main__":
    main()
