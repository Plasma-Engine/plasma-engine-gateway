"""
Minimal RBAC utilities.

Defines static roles and permissions and provides a dependency to require a
permission based on roles embedded in the JWT access token.
"""

from __future__ import annotations

from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.api.v1.deps import get_current_user
from app.core.security import verify_token


# Role to permission mapping. Extend as needed.
ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {"users:read", "users:write", "apikey:manage"},
    "editor": {"content:write", "content:read"},
    "viewer": {"content:read"},
    "api_user": {"api:access"},
}


def _has_permission(user_roles: Iterable[str], required: str) -> bool:
    for role in user_roles:
        if required in ROLE_PERMISSIONS.get(role, set()):
            return True
    return False


def require_permission(permission: str):
    """Return a dependency enforcing a specific permission via JWT roles."""

    def _dep(
        user_id: str = Depends(get_current_user),
        creds: HTTPAuthorizationCredentials | None = Depends(HTTPBearer(auto_error=False)),
    ) -> None:
        # We need roles; re-verify the token to extract claims (already verified by bearer dep)
        if creds is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_credentials")
        claims = verify_token(creds.credentials, expected_type="access")
        roles = claims.get("roles") or []
        if not isinstance(roles, list):
            roles = []
        if not _has_permission(roles, permission):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    return _dep

