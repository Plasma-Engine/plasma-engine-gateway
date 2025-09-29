"""
Reusable dependencies: current user extraction and rate limiting.
"""

from __future__ import annotations

import time
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.redis_client import get_redis_client
from app.core.security import verify_token


bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="missing_credentials")
    try:
        claims = verify_token(creds.credentials, expected_type="access")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_token") from exc
    return str(claims["sub"])  # return user identifier


def rate_limit(request: Request, user_id: str = Depends(get_current_user)) -> None:
    """Simple per-user fixed-window rate limiter.

    60 requests per minute per user. Uses Redis when available, otherwise an
    in-process fallback per worker. For production, prefer token-bucket and
    distributed counters.
    """
    key = f"ratelimit:{user_id}:{int(time.time() // 60)}"
    r = get_redis_client()
    if r is not None:
        try:
            count = r.incr(key)
            if count == 1:
                r.expire(key, 60)
            if count > 60:
                raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limited")
            return None
        except HTTPException:
            raise
        except Exception:
            # Fall back to in-memory on Redis errors
            pass

    # In-memory fallback
    store = getattr(request.app.state, "_rate_store", None)
    if store is None:
        store = {}
        request.app.state._rate_store = store
    count = store.get(key, 0) + 1
    store[key] = count
    if count > 60:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="rate_limited")

