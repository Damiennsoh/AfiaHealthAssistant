"""
AFIA Health Assistant — Health Check API
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db
from app.core.config import get_settings

router = APIRouter()


@router.get("/")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check for all services."""
    settings = get_settings()
    health_status = {
        "status": "healthy",
        "service": "afia-api",
        "version": "2.0.0",
        "checks": {}
    }

    # Check PostgreSQL
    try:
        await db.execute(text("SELECT 1"))
        health_status["checks"]["postgres"] = "healthy"
    except Exception as e:
        health_status["checks"]["postgres"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check Redis
    try:
        from app.main import app
        redis = app.state.redis
        await redis.ping()
        health_status["checks"]["redis"] = "healthy"
    except Exception as e:
        health_status["checks"]["redis"] = f"unhealthy: {str(e)}"
        health_status["status"] = "unhealthy"

    # Check Qdrant
    try:
        from app.services.rag_service import RAGService
        rag = RAGService()
        # Just check if we can list collections
        rag.qdrant.get_collections()
        health_status["checks"]["qdrant"] = "healthy"
    except Exception as e:
        health_status["checks"]["qdrant"] = f"unhealthy: {str(e)}"
        health_status["status"] = "degraded"

    # Check MinIO (optional)
    try:
        from minio import Minio
        minio_client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_root_user,
            secret_key=settings.minio_root_password,
            secure=settings.minio_secure
        )
        minio_client.list_buckets()
        health_status["checks"]["minio"] = "healthy"
    except Exception as e:
        health_status["checks"]["minio"] = f"unhealthy: {str(e)}"
        # Don't mark as unhealthy if MinIO is down, just degraded
        if health_status["status"] == "healthy":
            health_status["status"] = "degraded"

    return health_status


@router.get("/knowledge")
async def knowledge_health():
    """Check knowledge base connectivity."""
    try:
        from app.services.rag_service import RAGService
        rag = RAGService()
        return {
            "status": "healthy",
            "qdrant_connected": True,
            "collection": rag.collection_name,
        }
    except Exception as e:
        return {
            "status": "degraded",
            "qdrant_connected": False,
            "error": str(e),
        }
