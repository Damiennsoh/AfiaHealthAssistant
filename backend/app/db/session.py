"""
AFIA Health Assistant — Async Database Session
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.core.config import get_settings
from app.core.logging import logger

settings = get_settings()

# Create async engine
engine = create_async_engine(
    settings.async_database_url,
    echo=settings.environment == "development",
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

Base = declarative_base()


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables and seed super admin if needed."""
    from app.models import user, clinic, patient, encounter, audit, sync  # noqa
    from app.models.user import User, UserRole
    from app.core.security import get_password_hash
    from sqlalchemy import select
    from alembic.config import Config
    from alembic import command
    
    # Safely point Alembic configuration to the global settings instance URL
    try:
        alembic_cfg = Config("alembic.ini")
        alembic_url = settings.async_database_url.replace("+asyncpg", "")
        alembic_cfg.set_main_option("sqlalchemy.url", alembic_url)
        # Optional: Uncomment if you want automatic migrations to execute on startup
        # command.upgrade(alembic_cfg, "head")
        logger.info("Alembic configuration verified successfully")
    except Exception as e:
        logger.warning(f"Alembic startup check skipped or failed: {e}")

    # Create tables via fallback if missing
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified/initialized")
    
    # Seed super admin if not exists
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == UserRole.SUPER_ADMIN))
        existing = result.scalar_one_or_none()
        
        if not existing:
            # We explicitly read fallback parameters from global settings safely using getattr
            admin_email = getattr(settings, 'admin_email', 'admin@afia.health')
            admin_name = getattr(settings, 'admin_name', 'admin')
            admin_password = getattr(settings, 'admin_password', 'Admin1234!')
            
            super_admin = User(
                email=admin_email,
                name=admin_name,
                role=UserRole.SUPER_ADMIN,
                clinic_id=None,  # Super admin is global
                hashed_password=get_password_hash(admin_password),
                is_active=True,
                is_verified=True,
            )
            db.add(super_admin)
            await db.commit()
            logger.info(f"Super admin seeded: {admin_email}")
        else:
            # Update existing super admin to be global (no clinic)
            if existing.clinic_id is not None:
                existing.clinic_id = None
                await db.commit()
                logger.info(f"Updated existing super admin to be global: {existing.email}")
