"""
AFIA Health Assistant — Multi-tenant SaaS Configuration
SaaS + Hybrid Offline Model
"""
from functools import lru_cache
from pathlib import Path
from typing import List, Optional, ClassVar
from enum import Enum as PyEnum
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator

# Try to find .env in current dir, parent dir, or project root
_env_path = ".env"
if not Path(_env_path).exists():
    # Try parent directory (when running from backend/)
    parent_env = Path(__file__).parent.parent.parent / ".env"
    if parent_env.exists():
        _env_path = str(parent_env)


class Environment(str, PyEnum):
    """Application environment."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Pydantic v2 config
    model_config = SettingsConfigDict(
        env_file=_env_path,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Ignore extra env vars
    )

    # ── Application ──────────────────────────────────────────
    app_name: str = Field(default="AFIA Health Assistant")
    app_version: str = Field(default="2.0.0")
    environment: Environment = Field(default=Environment.DEVELOPMENT)
    log_level: str = Field(default="INFO")
    debug: bool = Field(default=False)
    supported_countries: list = Field(default=["GH", "ZW"])

    @property
    def is_development(self) -> bool:
        return self.environment == Environment.DEVELOPMENT

    # ── Security ─────────────────────────────────────────────
    secret_key: str
    access_token_expire_minutes: int = Field(default=480)
    refresh_token_expire_days: int = Field(default=7)
    field_encryption_key: str
    rate_limit_requests: int = Field(default=100)
    rate_limit_window: int = Field(default=60)

    # ── Database ─────────────────────────────────────────────
    database_url: str

    # ── Redis ────────────────────────────────────────────────
    redis_url: str

    # ── Qdrant ───────────────────────────────────────────────
    qdrant_url: str
    qdrant_api_key: Optional[str] = Field(default=None)

    # ── MinIO ────────────────────────────────────────────────
    minio_endpoint: Optional[str] = Field(default=None)
    minio_root_user: Optional[str] = Field(default=None)
    minio_root_password: Optional[str] = Field(default=None)
    minio_secure: bool = Field(default=False)

    # ── API ──────────────────────────────────────────────────
    api_port: int = Field(default=8000)
    cors_origins: str = Field(default="http://localhost:3000")

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into list."""
        if isinstance(self.cors_origins, str):
            return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if isinstance(self.cors_origins, list):
            return self.cors_origins
        return ["http://localhost:3000"]

    # ── Billing (Stripe) ───────────────────────────────────
    stripe_secret_key: Optional[str] = Field(default=None)
    stripe_webhook_secret: Optional[str] = Field(default=None)
    stripe_price_basic: Optional[str] = Field(default=None)
    stripe_price_pro: Optional[str] = Field(default=None)
    stripe_price_enterprise: Optional[str] = Field(default=None)

    # ── Email ────────────────────────────────────────────────
    smtp_host: Optional[str] = Field(default=None)
    smtp_port: int = Field(default=587)
    smtp_user: Optional[str] = Field(default=None)
    smtp_password: Optional[str] = Field(default=None)

    # ── Knowledge Base Configuration ───────────────────────
    embedding_model: str = Field(default="all-MiniLM-L6-v2")
    embedding_dimension: int = Field(default=384)
    qdrant_collection: str = Field(default="medical_knowledge")

    # ── Super Admin Credentials ───────────────────────────
    admin_email: str = Field(default="admin@afia.health")
    admin_name: str = Field(default="admin")
    admin_password: str = Field(default="Admin1234!")

    # Country-specific knowledge base configs
    knowledge_bases: dict = Field(default_factory=lambda: {
        "GH": {
            "name": "Ghana Standard Treatment Guidelines 2017 + NHIS EML 2025",
            "document_path": "knowledge-base/ghana/GHANA-STG-2017.pdf",
            "document_path_nhis": "knowledge-base/ghana/NHIS-ML-2025.pdf",
            "embeddings_json": "knowledge-base/ghana/ghs-stg-embeddings.json",
            "nhis_json": "knowledge-base/ghana/nhis-embeddings.json",
            "offline_json": "static/knowledge/gh-knowledge-offline.json",
        },
        "ZW": {
            "name": "Zimbabwe Essential Drugs and Medicines List (EDLIZ) 2020",
            "document_path": "knowledge-base/zimbabwe/EDLIZ-2020-FINAL.pdf",
            "embeddings_json": "knowledge-base/zimbabwe/edliz-embeddings.json",
            "offline_json": "static/knowledge/zw-knowledge-offline.json",
        }
    })


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Country-specific helpers
def get_country_config(country_code: str) -> dict:
    """Get knowledge base configuration for a country."""
    settings = get_settings()
    return settings.knowledge_bases.get(country_code.upper(), {})


def get_qdrant_collection() -> str:
    """Get the single multi-tenant Qdrant collection name."""
    return get_settings().qdrant_collection
