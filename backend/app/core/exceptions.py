"""
AFIA Health Assistant — Custom HTTP Exceptions
"""
from fastapi import HTTPException, status


class AfiaException(HTTPException):
    """Base exception for AFIA API."""
    def __init__(self, status_code: int, detail: str, code: str = None, headers: dict = None):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.code = code


class AuthenticationError(AfiaException):
    """Invalid credentials or expired token."""
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail, "AUTH_ERROR")


class AuthorizationError(AfiaException):
    """Insufficient permissions."""
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status.HTTP_403_FORBIDDEN, detail, "FORBIDDEN")


class ClinicNotFoundError(AfiaException):
    """Clinic does not exist."""
    def __init__(self, detail: str = "Clinic not found"):
        super().__init__(status.HTTP_404_NOT_FOUND, detail, "CLINIC_NOT_FOUND")


class PatientNotFoundError(AfiaException):
    """Patient does not exist."""
    def __init__(self, detail: str = "Patient not found"):
        super().__init__(status.HTTP_404_NOT_FOUND, detail, "PATIENT_NOT_FOUND")


class ResourceNotFoundError(AfiaException):
    """Requested resource not found."""
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status.HTTP_404_NOT_FOUND, detail, "RESOURCE_NOT_FOUND")


class DuplicateResourceError(AfiaException):
    """Resource already exists."""
    def __init__(self, detail: str = "Resource already exists"):
        super().__init__(status.HTTP_409_CONFLICT, detail, "DUPLICATE")


class ValidationError(AfiaException):
    """Input validation failed."""
    def __init__(self, detail: str = "Validation error"):
        super().__init__(status.HTTP_422_UNPROCESSABLE_ENTITY, detail, "VALIDATION_ERROR")


class RateLimitError(AfiaException):
    """Rate limit exceeded."""
    def __init__(self, detail: str = "Rate limit exceeded"):
        super().__init__(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail,
            "RATE_LIMIT_EXCEEDED",
            headers={"Retry-After": "60"}
        )


class AccountLockedError(AfiaException):
    """Account locked due to failed login attempts."""
    def __init__(self, detail: str = "Account locked. Try again later."):
        super().__init__(status.HTTP_423_LOCKED, detail, "ACCOUNT_LOCKED")


class KnowledgeBaseError(AfiaException):
    """Knowledge base query failed."""
    def __init__(self, detail: str = "Knowledge base error"):
        super().__init__(status.HTTP_500_INTERNAL_SERVER_ERROR, detail, "KB_ERROR")


class SyncConflictError(AfiaException):
    """Offline sync conflict detected."""
    def __init__(self, detail: str = "Sync conflict detected"):
        super().__init__(status.HTTP_409_CONFLICT, detail, "SYNC_CONFLICT")
