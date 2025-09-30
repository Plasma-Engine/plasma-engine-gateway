"""
Authentication endpoints (PE-102):
 - OAuth2 password flow token issuance
 - Refresh token exchange

Notes:
 - RS256 is used when RSA keys are provided via env; otherwise HS256 for dev.
 - Refresh tokens are opaque JWTs stored/validated via Redis when available.
 - For production, integrate with Auth0/Clerk via JWKS validation.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field, validator

from app.core.redis_client import get_redis_client
from app.core.security import create_access_token, create_refresh_token, verify_token


router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Test user credentials until proper user store is implemented
TEST_USERS = {
    "admin": {"password": "admin123", "roles": ["admin"]},
    "user": {"password": "user123", "roles": ["viewer"]},
    "editor": {"password": "edit123", "roles": ["editor"]},
}

def _verify_user_credentials(username: str, password: str) -> tuple[bool, list[str]]:
    """Verify user credentials and return (is_valid, roles).
    
    TODO: Replace with proper user store integration (database, Auth0, etc.)
    Current implementation uses hardcoded test users for security.
    """
    user = TEST_USERS.get(username)
    if user and user["password"] == password:
        return True, user["roles"]
    return False, []

def _get_user_roles(username: str) -> list[str]:
    """Get user roles without password verification.
    
    Used for token refresh when we already verified the user via refresh token.
    TODO: Replace with proper user store integration.
    """
    user = TEST_USERS.get(username)
    return user["roles"] if user else []


@router.post("/token", response_model=TokenResponse)
def issue_token(form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    is_valid, roles = _verify_user_credentials(form_data.username, form_data.password)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    subject = form_data.username
    access = create_access_token(subject, extra_claims={"scopes": form_data.scopes, "roles": roles})
    refresh = create_refresh_token(subject)

    r = get_redis_client()
    if r is not None:
        # Store refresh token with TTL for blacklisting/rotation
        try:
            r.setex(f"refresh:{subject}:{refresh}", 7 * 24 * 3600, "1")
        except Exception:
            # Do not block token issuance if Redis is unavailable
            pass

    return TokenResponse(access_token=access, refresh_token=refresh)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10, max_length=2048, description="JWT refresh token")
    
    @validator('refresh_token')
    def validate_refresh_token(cls, v):
        if not v or not v.strip():
            raise ValueError('refresh_token cannot be empty')
        # Basic JWT format check (header.payload.signature)
        parts = v.split('.')
        if len(parts) != 3:
            raise ValueError('refresh_token must be a valid JWT format')
        return v.strip()


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshRequest) -> TokenResponse:
    try:
        claims = verify_token(payload.refresh_token, expected_type="refresh")
    except Exception as exc:  # jwt.InvalidTokenError et al
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_refresh_token") from exc

    subject = str(claims["sub"])  # user id/username

    r = get_redis_client()
    if r is not None:
        key = f"refresh:{subject}:{payload.refresh_token}"
        try:
            if r.get(key) is None:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="refresh_token_revoked")
        except HTTPException:
            raise
        except Exception:
            # On Redis failure, proceed with stateless validation only
            pass

    # Preserve roles from original token or retrieve from user store
    roles = claims.get("roles", [])
    if not roles:
        # Fallback: re-fetch roles from user store if missing from token
        roles = _get_user_roles(subject)
    
    new_access = create_access_token(subject, extra_claims={"roles": roles})
    new_refresh = create_refresh_token(subject)

    if r is not None:
        try:
            # Rotate refresh: revoke old, store new
            r.delete(f"refresh:{subject}:{payload.refresh_token}")
            r.setex(f"refresh:{subject}:{new_refresh}", 7 * 24 * 3600, "1")
        except Exception:
            pass

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)

