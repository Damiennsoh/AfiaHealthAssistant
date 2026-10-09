"""
AFIA Health Assistant — Audit Log API
Role-based access to audit logs for compliance and monitoring
"""
from typing import Any, Dict, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.api.deps import get_current_active_user
from app.models.user import User, UserRole
from app.models.audit import AuditLog, AuditAction
from app.services.audit_service import AuditService

router = APIRouter()


CLINIC_AUDIT_ACTIONS = [
    AuditAction.PATIENT_CREATED,
    AuditAction.PATIENT_READ,
    AuditAction.PATIENT_SEARCHED,
    AuditAction.PATIENT_UPDATED,
    AuditAction.PATIENT_DELETED,
    AuditAction.ENCOUNTER_CREATED,
    AuditAction.ENCOUNTER_READ,
    AuditAction.ENCOUNTER_UPDATED,
    AuditAction.ENCOUNTER_COMPLETED,
    AuditAction.ENCOUNTER_DELETED,
    AuditAction.STAFF_ADDED,
    AuditAction.STAFF_DELETED,
    AuditAction.STAFF_DEACTIVATED,
    AuditAction.USER_CREATED,
    AuditAction.USER_UPDATED,
    AuditAction.USER_DELETED,
    AuditAction.USER_PROFILE_UPDATED,
    AuditAction.BACKUP_CREATED,
    AuditAction.BACKUP_RESTORED,
    AuditAction.REPORT_EXPORTED,
    AuditAction.PATIENT_REFERRED,
]

CLIENT_AUDIT_ACTIONS = {
    AuditAction.PATIENT_CREATED,
    AuditAction.PATIENT_READ,
    AuditAction.PATIENT_SEARCHED,
    AuditAction.PATIENT_UPDATED,
    AuditAction.PATIENT_DELETED,
    AuditAction.ENCOUNTER_CREATED,
    AuditAction.ENCOUNTER_UPDATED,
    AuditAction.ENCOUNTER_COMPLETED,
    AuditAction.ENCOUNTER_DELETED,
    AuditAction.BACKUP_CREATED,
    AuditAction.BACKUP_RESTORED,
    AuditAction.REPORT_EXPORTED,
    AuditAction.PATIENT_REFERRED,
}


class AuditEventCreate(BaseModel):
    action: AuditAction
    expected_user_id: UUID
    resource_type: Optional[str] = Field(default=None, max_length=50)
    resource_id: Optional[str] = Field(default=None, max_length=100)
    details: Dict[str, Any] = Field(default_factory=dict)


def _safe_event_details(action: AuditAction, details: Dict[str, Any]) -> Dict[str, Any]:
    """Keep only minimal, non-clinical metadata from browser-originated events."""
    allowed_fields = {
        AuditAction.BACKUP_CREATED: {"patient_count", "encounter_count", "encrypted"},
        AuditAction.BACKUP_RESTORED: {"patient_count", "encounter_count"},
        AuditAction.REPORT_EXPORTED: {"report_type", "record_count"},
    }.get(action, set())
    safe_details: Dict[str, Any] = {}
    for key in allowed_fields:
        value = details.get(key)
        if key.endswith("_count") and isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            safe_details[key] = value
        elif key == "encrypted" and isinstance(value, bool):
            safe_details[key] = value
        elif key == "report_type" and isinstance(value, str):
            safe_details[key] = value[:50]
    return safe_details


@router.get("/")
async def get_audit_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    action: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get clinical and facility-administration events for the authenticated clinic admin's clinic.
    Global superadmins and regular staff do not have access to this facility audit feed.
    """
    if current_user.role != UserRole.CLINIC_ADMIN:
        raise HTTPException(status_code=403, detail="Only this facility's clinic admin can view its audit logs")
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User not associated with a clinic")

    query = select(AuditLog).where(
        and_(
            AuditLog.clinic_id == current_user.clinic_id,
            AuditLog.action.in_(CLINIC_AUDIT_ACTIONS),
        )
    )
    
    # Apply filters
    if start_date:
        query = query.where(AuditLog.created_at >= start_date)
    if end_date:
        query = query.where(AuditLog.created_at <= end_date)
    if action:
        try:
            action_enum = AuditAction(action)
            query = query.where(AuditLog.action == action_enum)
        except ValueError:
            pass  # Invalid action, ignore filter
    if search:
        query = query.where(
            AuditLog.user_email.ilike(f"%{search}%") |
            AuditLog.clinic_name.ilike(f"%{search}%") |
            AuditLog.resource_id.ilike(f"%{search}%")
        )
    
    # Order and paginate
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [
        {
            "id": str(log.id),
            "user_email": log.user_email,
            "user_role": log.user_role,
            "clinic_name": log.clinic_name,
            "action": log.action.value,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]


@router.post("/events", status_code=201)
async def record_clinical_event(
    event: AuditEventCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a browser-side clinical event under the authenticated user's clinic."""
    if current_user.role not in {UserRole.CLINIC_ADMIN, UserRole.HEALTHWORKER}:
        raise HTTPException(status_code=403, detail="This account cannot record clinical activity")
        if event.expected_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Audit event actor does not match the authenticated user")
    if not current_user.clinic_id or not current_user.clinic:
        raise HTTPException(status_code=403, detail="User is not associated with a clinic")
    if current_user.clinic.is_demo_clinic:
        raise HTTPException(status_code=403, detail="Demo clinic events are not retained")
    if event.action not in CLIENT_AUDIT_ACTIONS:
        raise HTTPException(status_code=400, detail="Unsupported clinical audit action")

    resource_types = {"patient", "encounter", "backup", "report", "referral"}
    if event.resource_type and event.resource_type not in resource_types:
        raise HTTPException(status_code=400, detail="Unsupported audit resource type")

    entry = await AuditService(db).log(
        action=event.action,
        user=current_user,
        clinic=current_user.clinic,
        resource_type=event.resource_type,
        resource_id=event.resource_id,
        details=_safe_event_details(event.action, event.details),
        ip_address=getattr(current_user, "_ip_address", None),
        user_agent=getattr(current_user, "_user_agent", None),
    )
    return {"id": str(entry.id), "action": entry.action.value, "created_at": entry.created_at.isoformat()}


@router.get("/export")
async def export_audit_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    action: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export this clinic's audit logs as CSV. Only the clinic admin can export them.
    """
    from fastapi.responses import Response
    import csv
    import io
    
    # Get logs using same logic as get_audit_logs
    logs = await get_audit_logs(
        start_date=start_date,
        end_date=end_date,
        action=action,
        limit=10000,  # Higher limit for export
        offset=0,
        current_user=current_user,
        db=db,
    )
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Timestamp",
        "User Email",
        "User Role",
        "Clinic Name",
        "Action",
        "Resource Type",
        "Resource ID",
        "Details"
    ])
    
    for log in logs:
        writer.writerow([
            log["created_at"],
            log["user_email"] or "",
            log["user_role"] or "",
            log["clinic_name"] or "",
            log["action"],
            log["resource_type"] or "",
            log["resource_id"] or "",
            str(log["details"]) if log["details"] else ""
        ])
    
    output.seek(0)
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )
