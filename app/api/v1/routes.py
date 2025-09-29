"""
API v1 router stub.

Add new feature routers here and mount under /api/v1 in app.main.
"""

from fastapi import APIRouter


api_router = APIRouter()


@api_router.get("/status", tags=["api"])
def status() -> dict[str, str]:
    """Lightweight API status endpoint."""
    return {"service": "gateway", "status": "ok"}

