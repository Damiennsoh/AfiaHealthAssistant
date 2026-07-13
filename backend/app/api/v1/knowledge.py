"""
AFIA Health Assistant — Knowledge Base API
RAG query with country switching. SaaS mode only.
Offline clinics use client-side search (PWA).
"""
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.api.deps import get_current_active_user, require_healthworker
from app.models.user import User
from app.models.audit import AuditAction
from app.schemas.knowledge import KnowledgeQuery, KnowledgeQueryResponse
from app.services.rag_service import RAGService
from app.services.audit_service import AuditService

router = APIRouter()


@router.post("/query", response_model=KnowledgeQueryResponse)
async def query_knowledge(
    request: Request,
    query_data: KnowledgeQuery,
    current_user: User = Depends(require_healthworker),
    db: AsyncSession = Depends(get_db),
):
    """Query medical knowledge base (Qdrant vector search).

    For offline clinics, this endpoint is not used — 
    the PWA performs client-side cosine similarity search.
    """
    # Auto-set country from user's clinic
    if not query_data.country_code:
        query_data.country_code = current_user.clinic.country_code if current_user.clinic else "GH"

    # Verify clinic has active subscription
    if current_user.clinic and not current_user.clinic.is_active:
        raise HTTPException(status_code=403, detail="Clinic subscription inactive")

    rag_service = RAGService()
    result = await rag_service.query(query_data)

    # Audit log
    audit_service = AuditService(db)
    await audit_service.log(
        action=AuditAction.KB_QUERIED,
        user=current_user,
        clinic=current_user.clinic,
        kb_query=query_data.query,
        kb_country=query_data.country_code,
        kb_results_count=result.total_results,
        kb_top_citation=result.results[0].citation if result.results else None,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return result


@router.get("/bases")
async def list_knowledge_bases(
    current_user: User = Depends(require_healthworker),
):
    """List all available knowledge bases."""
    from app.core.config import get_settings
    settings = get_settings()
    
    bases = []
    for code, config in settings.knowledge_bases.items():
        bases.append({
            "country_code": code,
            "name": config["name"]
        })
    return bases


@router.get("/bases/{country_code}")
async def get_knowledge_base_info(
    country_code: str,
    current_user: User = Depends(require_healthworker),
):
    """Get information about a specific knowledge base."""
    rag_service = RAGService()
    return await rag_service.get_kb_info(country_code)


@router.get("/offline-package/{country_code}")
async def get_offline_package(
    country_code: str,
    current_user: User = Depends(require_healthworker),
):
    """Get offline knowledge base package for PWA download.

    Returns metadata + download URL for the full JSON embeddings file.
    Rural clinics call this once, then use client-side search.
    """
    from app.core.config import get_country_config
    from pathlib import Path
    import hashlib
    import json

    config = get_country_config(country_code.upper())
    if not config:
        raise HTTPException(status_code=404, detail="Knowledge base not found")
    
    offline_file = Path(f"static/knowledge/{country_code.lower()}-knowledge-offline.json")
    total_chunks = 0
    checksum = ""
    
    if offline_file.exists():
        with open(offline_file, "r") as f:
            data = json.load(f)
            total_chunks = data.get("total_chunks", 0)
            checksum = data.get("checksum", "")
    
    return {
        "country_code": country_code.upper(),
        "name": config["name"],
        "download_url": f"/static/knowledge/{country_code.lower()}-knowledge-offline.json",
        "version": "2025.06.15",
        "checksum": checksum,
        "total_chunks": total_chunks,
        "embedding_model": "all-MiniLM-L6-v2",
        "embedding_dimension": 384,
    }
