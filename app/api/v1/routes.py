"""
API v1 router stub.

Add new feature routers here and mount under /api/v1 in app.main.
"""

from fastapi import APIRouter, Depends

from app.api.v1.deps import rate_limit, get_current_user

api_router = APIRouter()


@api_router.get("/status", tags=["api"])
def status() -> dict[str, str]:
    """Lightweight API status endpoint."""
    return {"service": "gateway", "status": "ok"}


@api_router.get("/me", tags=["api"])
def me(user_id: str = Depends(get_current_user), _rl: None = Depends(rate_limit)) -> dict[str, str]:
    """Return the current user's identifier if authenticated."""
    return {"user": user_id}

