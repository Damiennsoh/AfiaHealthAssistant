"""
AFIA Health Assistant — Health Check API
"""
from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from qdrant_client import QdrantClient

from app.db.session import get_db
from app.core.config import get_settings, get_qdrant_collection

router = APIRouter()


def _qdrant_status():
    settings = get_settings()
    collection_name = get_qdrant_collection()
    client = QdrantClient(
        url=settings.qdrant_url,
        api_key=settings.qdrant_api_key,
        timeout=5,
    )
    collections = client.get_collections().collections
    collection_exists = any(collection.name == collection_name for collection in collections)
    if not collection_exists:
        return {
            "status": "degraded",
            "qdrant_connected": True,
            "collection": collection_name,
            "collection_exists": False,
            "points_count": 0,
        }

    collection = client.get_collection(collection_name=collection_name)
    points_count = collection.points_count or 0
    return {
        "status": "healthy" if points_count > 0 else "degraded",
        "qdrant_connected": True,
        "collection": collection_name,
        "collection_exists": True,
        "points_count": points_count,
        "collection_status": str(collection.status),
    }


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

    # Check Qdrant and verify that the clinical collection has been indexed.
    try:
        qdrant_status = await run_in_threadpool(_qdrant_status)
        health_status["checks"]["qdrant"] = qdrant_status["status"]
        health_status["checks"]["qdrant_details"] = qdrant_status
        if qdrant_status["status"] != "healthy":
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["checks"]["qdrant"] = f"unhealthy: {type(e).__name__}"
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
        return await run_in_threadpool(_qdrant_status)
    except Exception as e:
        return {
            "status": "degraded",
            "qdrant_connected": False,
            "error": type(e).__name__,
        }
