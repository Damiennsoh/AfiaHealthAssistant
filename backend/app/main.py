"""
AFIA Health Assistant — FastAPI Application Entry Point
SaaS + Hybrid Offline Model
"""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import time
import redis.asyncio as redis
import hashlib

from app.core.config import get_settings, Environment
from app.core.logging import configure_logging, logger
from app.core.exceptions import AfiaException, RateLimitError
from app.db.session import init_db
from app.api.v1 import auth, users, clinics, patients, encounters, knowledge, sync, health, websocket, audit

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    configure_logging()
    logger.info(f"Starting {settings.app_name} v{settings.app_version}...")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Supported countries: {settings.supported_countries}")
    
    # Initialize Redis connection
    app.state.redis = redis.from_url(settings.redis_url, decode_responses=True)
    logger.info("Redis initialized")
    
    await init_db()
    logger.info("Database initialized")
    
    yield
    
    # Clean up Redis connection
    await app.state.redis.close()
    logger.info("Shutting down AFIA Health Assistant API")


app = FastAPI(
    title="AFIA Health Assistant API",
    description="SaaS + Hybrid Offline Medical Knowledge System",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
)

# Mount static files for knowledge base downloads
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
    logger.info(f"Static files mounted from: {static_dir}")
else:
    logger.warning(f"Static directory not found: {static_dir}")

# Enhanced CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Country-Code", "X-KB-Version", "X-Request-ID"],
    max_age=600,
)

# Rate limiting middleware
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for health check, OPTIONS, and public endpoints
    if (
        request.url.path == "/api/v1/health" 
        or request.method == "OPTIONS"
        or "/api/v1/clinics/public" in request.url.path
    ):
        return await call_next(request)
    
    # Get client identifier (use IP)
    client_ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:{hashlib.sha256(client_ip.encode()).hexdigest()}"
    
    # Use Redis to track requests
    redis_client = request.app.state.redis
    
    try:
        # Increment request count with expiration
        request_count = await redis_client.incr(key)
        
        if request_count == 1:
            # Set expiration on first request
            await redis_client.expire(key, settings.rate_limit_window)
        
        if request_count > settings.rate_limit_requests:
            # Get remaining time
            ttl = await redis_client.ttl(key)
            raise RateLimitError(f"Rate limit exceeded. Try again in {ttl} seconds.")
            
    except RateLimitError:
        raise
    except Exception as e:
        logger.warning(f"Rate limiting failed: {e}")
    
    return await call_next(request)

# Request timing and security headers middleware
@app.middleware("http")
async def add_request_timing_and_security_headers(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time"] = f"{process_time:.2f}ms"
    
    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    
    # Content Security Policy (CSP)
    csp = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self';"
    )
    response.headers["Content-Security-Policy"] = csp
    
    # Strict Transport Security (HSTS) - only in production
    if settings.environment == Environment.PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    
    return response

# Exception handler for custom exceptions
@app.exception_handler(AfiaException)
async def afia_exception_handler(request: Request, exc: AfiaException):
    # Extract the origin header from the request
    origin = request.headers.get("origin")

    # Define custom headers with fallback safety
    response_headers = {**(exc.headers or {})}

    # If the request came from an origin in your CORS settings, append it
    if origin in settings.cors_origins_list:
        response_headers["Access-Control-Allow-Origin"] = origin
        response_headers["Access-Control-Allow-Credentials"] = "true"

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "path": str(request.url.path),
        },
        headers=response_headers
    )

# API Routes
app.include_router(health.router, prefix="/api/v1/health", tags=["health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(clinics.router, prefix="/api/v1/clinics", tags=["clinics"])
app.include_router(patients.router, prefix="/api/v1/patients", tags=["patients"])
app.include_router(encounters.router, prefix="/api/v1/encounters", tags=["encounters"])
app.include_router(knowledge.router, prefix="/api/v1/knowledge", tags=["knowledge"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(websocket.router, prefix="/api/v1/websocket", tags=["websocket"])
app.include_router(audit.router, prefix="/api/v1/audit", tags=["audit"])


@app.get("/")
async def root():
    return {
        "name": "AFIA Health Assistant",
        "version": "2.0.0",
        "model": "SaaS + Hybrid Offline",
        "status": "operational",
    }
