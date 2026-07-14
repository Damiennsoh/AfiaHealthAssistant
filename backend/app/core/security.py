"""
AFIA Health Assistant — Security & Encryption
JWT, bcrypt, AES field-level encryption for patient PII
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Union

from jose import JWTError, jwt
import bcrypt
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

from app.core.config import get_settings

# ── Password Hashing ─────────────────────────────────────────

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'),
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt with 12 rounds."""
    # Bcrypt only uses first 72 bytes
    truncated_password = password[:72].encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(truncated_password, salt).decode('utf-8')


# ── JWT Token Handling ───────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with clinic context."""
    settings = get_settings()
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)

    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT token."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        return payload
    except JWTError:
        return None


# ── Field-Level Encryption (Patient PII) ───────────────────

class FieldEncryption:
    """AES-256 encryption for sensitive patient fields."""

    def __init__(self):
        settings = get_settings()
        # Derive a 32-byte key from the configured encryption key
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"afia_health_assistant_salt_v1",  # In production, use per-field salt
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(settings.field_encryption_key.encode()))
        self.fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a string value."""
        if not plaintext:
            return ""
        return self.fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt an encrypted string value."""
        if not ciphertext:
            return ""
        return self.fernet.decrypt(ciphertext.encode()).decode()


# Singleton instance
field_encryption = FieldEncryption()


def encrypt_field(value: Optional[str]) -> str:
    """Encrypt a field value."""
    return field_encryption.encrypt(value or "")


def decrypt_field(value: Optional[str]) -> str:
    """Decrypt a field value."""
    return field_encryption.decrypt(value or "")


# ── Secure Token Generation ────────────────────────────────

def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    return secrets.token_urlsafe(length)


def generate_folder_number(country_code: str, clinic_code: str, sequence: int) -> str:
    """Generate a standardized patient folder number.

    Format: {CC}-{CLINIC}-{YYYY}{SEQUENCE:06d}
    Example: GH-ACCRA-2024000001
    """
    year = datetime.now().year
    return f"{country_code.upper()}-{clinic_code.upper()}-{year}{sequence:06d}"


# ── Password Policy Validation ───────────────────────────────

def validate_password_policy(password: str) -> tuple[bool, Optional[str]]:
    """Validate password against medical-grade policy.

    Returns: (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"

    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"

    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"

    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"

    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False, "Password must contain at least one special character"

    return True, None
