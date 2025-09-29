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

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.core.redis_client import get_redis_client
from app.core.security import create_access_token, create_refresh_token, get_jwt_settings, verify_token

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


def _verify_user_credentials(username: str, password: str) -> bool:
    # Replace with proper user store. For now accept any non-empty creds.
    return bool(username) and bool(password)


@router.post("/token", response_model=TokenResponse)
def issue_token(form_data: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    if not _verify_user_credentials(form_data.username, form_data.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")

    subject = form_data.username
    access = create_access_token(subject, extra_claims={"scopes": form_data.scopes})
    refresh = create_refresh_token(subject)

    r = get_redis_client()
    if r is not None:
        # Store refresh token with TTL for blacklisting/rotation
        try:
            jwt_settings = get_jwt_settings()
            ttl_seconds = jwt_settings.refresh_token_days * 24 * 3600
            r.setex(f"refresh:{subject}:{refresh}", ttl_seconds, "1")
        except Exception as e:
            # Do not block token issuance if Redis is unavailable
            logger.warning(f"Redis operation failed during token issuance: {e}")
            pass

    return TokenResponse(access_token=access, refresh_token=refresh)


class RefreshRequest(BaseModel):
    refresh_token: str


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
        except Exception as e:
            # On Redis failure, proceed with stateless validation only
            logger.warning(f"Redis operation failed during refresh validation: {e}")
            pass

    new_access = create_access_token(subject)
    new_refresh = create_refresh_token(subject)

    if r is not None:
        try:
            # Rotate refresh: store new first, then revoke old (safer order)
            jwt_settings = get_jwt_settings()
            ttl_seconds = jwt_settings.refresh_token_days * 24 * 3600
            r.setex(f"refresh:{subject}:{new_refresh}", ttl_seconds, "1")
            r.delete(f"refresh:{subject}:{payload.refresh_token}")
        except Exception as e:
            logger.warning(f"Redis operation failed during token rotation: {e}")
            pass

    return TokenResponse(access_token=new_access, refresh_token=new_refresh)

