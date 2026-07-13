#!/usr/bin/env python3
"""
Check users in database
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import asyncio
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.clinic import Clinic
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        
        print("=== Users in Database ===\n")
        
        if not users:
            print("No users found in database")
            return
        
        for user in users:
            print(f"Email: {user.email}")
            print(f"Name: {user.name}")
            print(f"Role: {user.role}")
            print(f"Clinic ID: {user.clinic_id}")
            print(f"Active: {user.is_active}")
            print(f"Verified: {user.is_verified}")
            print()

if __name__ == "__main__":
    asyncio.run(main())
