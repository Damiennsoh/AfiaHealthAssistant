"""
AFIA Health Assistant — Audit Service
HIPAA/GDPR compliance logging
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.logging import audit_logger
from app.models.audit import AuditLog, AuditAction
from app.models.user import User
from app.models.clinic import Clinic


class AuditService:
    """Log every data access for compliance."""

    RETENTION_YEARS = 7

    def __init__(self, db: AsyncSession):
        self.db = db

    async def log(
        self,
        action: AuditAction,
        user: Optional[User] = None,
        clinic: Optional[Clinic] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        kb_query: Optional[str] = None,
        kb_country: Optional[str] = None,
        kb_results_count: Optional[int] = None,
        kb_top_citation: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> AuditLog:
        """Create an audit log entry."""

        log_entry = AuditLog(
            user_id=user.id if user else None,
            user_email=user.email if user else None,
            user_role=user.role.value if user else None,
            clinic_id=clinic.id if clinic else None,
            clinic_name=clinic.name if clinic else None,
            ip_address=ip_address,
            user_agent=user_agent,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details or {},
            kb_query=kb_query,
            kb_country=kb_country,
            kb_results_count=kb_results_count,
            kb_top_citation=kb_top_citation,
            retention_until=datetime.now(timezone.utc) + timedelta(days=365 * self.RETENTION_YEARS),
        )

        self.db.add(log_entry)
        await self.db.commit()
        return log_entry

    async def get_audit_logs(
        self,
        clinic_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        action: Optional[AuditAction] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
    ):
        """Query audit logs with filters."""
        query = select(AuditLog)

        if clinic_id:
            query = query.where(AuditLog.clinic_id == clinic_id)
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action == action)
        if start_date:
            query = query.where(AuditLog.created_at >= start_date)
        if end_date:
            query = query.where(AuditLog.created_at <= end_date)

        query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)

        result = await self.db.execute(query)
        return result.scalars().all()
