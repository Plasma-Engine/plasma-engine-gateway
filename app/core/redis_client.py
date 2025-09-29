"""
Redis client factory with lazy initialization.

For tests, you can set REDIS_URL=fakeredis:// to use an in-memory fake.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

import redis


@lru_cache(maxsize=1)
def get_redis_client() -> Optional[redis.Redis]:
    url = os.getenv("REDIS_URL")
    if not url:
        return None
    if url.startswith("fakeredis://"):
        # Lazy import to avoid test-only dependency at runtime
        import fakeredis  # type: ignore

        return fakeredis.FakeRedis()
    return redis.from_url(url, decode_responses=True)

