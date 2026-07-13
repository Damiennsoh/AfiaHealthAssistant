import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.clinic import Clinic
from app.core.security import get_password_hash


async def create_ghana_clinic():
    async with AsyncSessionLocal() as db:
        # Check if super admin exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))
        super_admin = result.scalar_one_or_none()
        
        if not super_admin:
            print("Super admin not found! Please create a super admin first.")
            return

        # Check if clinic already exists
        result = await db.execute(select(Clinic).where(Clinic.code == "GH-TEST-001"))
        existing_clinic = result.scalar_one_or_none()
        if existing_clinic:
            print("Ghana clinic already exists!")
            return

        # Create Ghana clinic
        gh_clinic = Clinic(
            name="Ghana National Hospital",
            code="GH-TEST-001",
            country_code="GH",
            region="Greater Accra",
            district="Accra Metropolis",
            tier="enterprise",
            require_staff_id=False,
            require_department=False,
            is_active=True
        )
        db.add(gh_clinic)
        await db.flush()
        
        # Create admin user for Ghana clinic
        gh_admin = User(
            email="gh-admin@afia.health",
            name="Ghana Admin",
            role=UserRole.CLINIC_ADMIN,
            clinic_id=gh_clinic.id,
            hashed_password=get_password_hash("Admin123!"),
            is_active=True,
            is_verified=True,
        )
        db.add(gh_admin)
        
        gh_clinic.admin_user_id = gh_admin.id
        
        await db.commit()
        
        print(f"\n✅ Ghana Test Clinic Created!")
        print(f"   Clinic Name: {gh_clinic.name}")
        print(f"   Clinic Code: {gh_clinic.code}")
        print(f"   Country: Ghana (GH)")
        print(f"   Admin Email: gh-admin@afia.health")
        print(f"   Admin Password: Admin123!")


if __name__ == "__main__":
    asyncio.run(create_ghana_clinic())
