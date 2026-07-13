#!/usr/bin/env python3
"""
Check clinics in database
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.db.session import AsyncSessionLocal
from app.models.clinic import Clinic
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Clinic))
        clinics = result.scalars().all()
        
        print("=== Clinics in Database ===\n")
        
        if not clinics:
            print("No clinics found in database")
            return
        
        for clinic in clinics:
            print(f"Name: {clinic.name}")
            print(f"Code: {clinic.code}")
            print(f"Country: {clinic.country_code}")
            print(f"Active: {clinic.is_active}")
            print(f"ID: {clinic.id}")
            print(f"Admin User ID: {clinic.admin_user_id}")
            print()

if __name__ == "__main__":
    asyncio.run(main())
