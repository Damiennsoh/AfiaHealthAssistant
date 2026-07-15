"""
AFIA Health Assistant — Audit Log API
Role-based access to audit logs for compliance and monitoring
"""
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.db.session import get_db
from app.api.deps import require_super_admin, require_clinic_admin, get_current_active_user
from app.models.user import User, UserRole
from app.models.audit import AuditLog, AuditAction
from app.services.audit_service import AuditService

router = APIRouter()


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
    Get audit logs with role-based filtering.
    
    - Superadmin: All clinic-level events (clinic added/deleted/suspended, details updated)
    - Clinic admin: Patient/encounter/staff events for their clinic only
    - Regular staff: No access (403)
    """
    audit_service = AuditService(db)
    
    # Regular staff cannot access audit logs
    if current_user.role == UserRole.STAFF:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Build query based on user role
    if current_user.role == UserRole.SUPER_ADMIN:
        # Superadmin sees clinic-level events
        clinic_actions = [
            AuditAction.CLINIC_SUSPENDED,
            AuditAction.CLINIC_UNSUSPENDED,
            AuditAction.CLINIC_ARCHIVED,
            AuditAction.CLINIC_DELETED,
            AuditAction.CLINIC_UPDATED,
            AuditAction.USER_CREATED,
            AuditAction.USER_DELETED,
        ]
        query = select(AuditLog).where(AuditLog.action.in_(clinic_actions))
    elif current_user.role == UserRole.CLINIC_ADMIN:
        # Clinic admin sees their clinic's patient/encounter/staff events
        if not current_user.clinic_id:
            raise HTTPException(status_code=400, detail="User not associated with a clinic")
        
        clinic_actions = [
            AuditAction.PATIENT_CREATED,
            AuditAction.PATIENT_UPDATED,
            AuditAction.PATIENT_READ,
            AuditAction.ENCOUNTER_CREATED,
            AuditAction.ENCOUNTER_UPDATED,
            AuditAction.ENCOUNTER_READ,
            AuditAction.STAFF_ADDED,
            AuditAction.STAFF_DELETED,
        ]
        query = select(AuditLog).where(
            and_(
                AuditLog.clinic_id == current_user.clinic_id,
                AuditLog.action.in_(clinic_actions)
            )
        )
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
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


@router.get("/export")
async def export_audit_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    action: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Export audit logs as CSV.
    Only accessible to superadmin and clinic admin.
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
