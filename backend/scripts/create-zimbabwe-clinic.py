
"""
Script to create a Zimbabwe test clinic
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.clinic import Clinic
from app.core.security import get_password_hash


async def create_zimbabwe_clinic():
    async with AsyncSessionLocal() as db:
        # Check if super admin exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))
        super_admin = result.scalar_one_or_none()
        
        if not super_admin:
            print("Super admin not found!")
            return

        # Create Zimbabwe clinic
        zw_clinic = Clinic(
            name="Zimbabwe Test Clinic",
            code="ZW-TEST-001",
            country_code="ZW",
            region="Harare",
            district="Harare Central",
            tier="enterprise",
            require_staff_id=False,
            require_department=False,
        )
        db.add(zw_clinic)
        await db.flush()
        
        # Create admin user for Zimbabwe clinic
        zw_admin = User(
            email="zw-admin@afia.health",
            name="Zimbabwe Admin",
            role=UserRole.CLINIC_ADMIN,
            clinic_id=zw_clinic.id,
            hashed_password=get_password_hash("Admin123!"),
            is_active=True,
            is_verified=True,
        )
        db.add(zw_admin)
        
        zw_clinic.admin_user_id = zw_admin.id
        
        await db.commit()
        
        print(f"\n✅ Zimbabwe Test Clinic Created!")
        print(f"   Clinic Name: {zw_clinic.name}")
        print(f"   Clinic Code: {zw_clinic.code}")
        print(f"   Country: Zimbabwe (ZW)")
        print(f"   Admin Email: zw-admin@afia.health")
        print(f"   Admin Password: Admin123!")


if __name__ == "__main__":
    asyncio.run(create_zimbabwe_clinic())

