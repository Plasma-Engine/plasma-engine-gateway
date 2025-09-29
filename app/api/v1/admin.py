"""
Admin endpoints protected by RBAC (PE-104).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.rbac import require_permission


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", dependencies=[Depends(require_permission("users:read"))])
def list_users() -> dict[str, list[dict[str, str]]]:
    # Placeholder dataset
    return {"users": [{"id": "alice"}, {"id": "bob"}]}

