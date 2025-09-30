"""
Security utilities: JWT creation/verification and key management.

Implements OAuth2 password flow token issuance. Uses RS256 if RSA keys are
provided via environment, otherwise falls back to HS256 for development.
Access tokens default to 15 minutes; refresh tokens default to 7 days.
"""

from __future__ import annotations

import datetime as dt
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import jwt


@dataclass(frozen=True)
class JwtSettings:
    issuer: str
    audience: str
    access_token_minutes: int
    refresh_token_days: int
    algorithm: str
    private_key: Optional[str]
    public_key: Optional[str]
    hs256_secret: Optional[str]


def _load_rsa_keys() -> tuple[Optional[str], Optional[str]]:
    private_key = os.getenv("JWT_PRIVATE_KEY")
    public_key = os.getenv("JWT_PUBLIC_KEY")
    return private_key, public_key


def get_jwt_settings() -> JwtSettings:
    private_key, public_key = _load_rsa_keys()
    hs_secret = os.getenv("JWT_SECRET")
    algorithm = "RS256" if private_key and public_key else "HS256"

    return JwtSettings(
        issuer=os.getenv("JWT_ISS", "plasma-engine-gateway"),
        audience=os.getenv("JWT_AUD", "plasma-engine-clients"),
        access_token_minutes=int(os.getenv("JWT_ACCESS_MINUTES", "15")),
        refresh_token_days=int(os.getenv("JWT_REFRESH_DAYS", "7")),
        algorithm=algorithm,
        private_key=private_key,
        public_key=public_key,
        hs256_secret=hs_secret,
    )


def _get_signing_key(settings: JwtSettings) -> str:
    if settings.algorithm == "RS256":
        assert settings.private_key, "RS256 requires JWT_PRIVATE_KEY"
        return settings.private_key
    assert settings.hs256_secret, "HS256 requires JWT_SECRET"
    return settings.hs256_secret


def _get_verification_key(settings: JwtSettings) -> str:
    if settings.algorithm == "RS256":
        assert settings.public_key, "RS256 requires JWT_PUBLIC_KEY"
        return settings.public_key
    assert settings.hs256_secret, "HS256 requires JWT_SECRET"
    return settings.hs256_secret


def create_access_token(subject: str, extra_claims: Optional[Dict[str, Any]] = None) -> str:
    settings = get_jwt_settings()
    now = dt.datetime.now(dt.timezone.utc)
    exp = now + dt.timedelta(minutes=settings.access_token_minutes)
    claims: Dict[str, Any] = {
        "sub": subject,
        "iss": settings.issuer,
        "aud": settings.audience,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "typ": "access",
    }
    if extra_claims:
        claims.update(extra_claims)
    token = jwt.encode(claims, _get_signing_key(settings), algorithm=settings.algorithm)
    return token


def create_refresh_token(subject: str) -> str:
    settings = get_jwt_settings()
    now = dt.datetime.now(dt.timezone.utc)
    exp = now + dt.timedelta(days=settings.refresh_token_days)
    claims: Dict[str, Any] = {
        "sub": subject,
        "iss": settings.issuer,
        "aud": settings.audience,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "typ": "refresh",
    }
    token = jwt.encode(claims, _get_signing_key(settings), algorithm=settings.algorithm)
    return token


def verify_token(token: str, *, expected_type: Optional[str] = None) -> Dict[str, Any]:
    settings = get_jwt_settings()
    claims = jwt.decode(
        token,
        _get_verification_key(settings),
        algorithms=[settings.algorithm],
        audience=settings.audience,
        issuer=settings.issuer,
    )
    if expected_type and claims.get("typ") != expected_type:
        raise jwt.InvalidTokenError("Unexpected token type")
    return claims

