"""
AFIA Health Assistant — Structured JSON Logging
For audit compliance and monitoring
"""
import sys
import structlog
from structlog.processors import JSONRenderer
from app.core.config import get_settings


def configure_logging():
    """Configure structured logging for the application."""
    settings = get_settings()

    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


# Pre-configured loggers
logger = structlog.get_logger("afia.api")
audit_logger = structlog.get_logger("afia.audit")
security_logger = structlog.get_logger("afia.security")
