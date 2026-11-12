"""Tiny in-memory sliding-window rate limiter (per client IP).

Good enough for a single-instance deployment. For multiple instances,
replace with a shared store such as Redis.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import Request

from ..config import get_settings
from .errors import AppError


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > self.window:
                q.popleft()
            if len(q) >= self.limit:
                raise AppError(
                    "لقد أرسلت طلبات كثيرة خلال وقت قصير. يرجى الانتظار قليلًا ثم المحاولة مجددًا.",
                    "rate_limited",
                    429,
                )
            q.append(now)
            if len(self._hits) > 10_000:  # bound memory
                for k in [k for k, v in self._hits.items() if not v]:
                    del self._hits[k]


_settings = get_settings()
analyze_limiter = RateLimiter(_settings.rate_limit_requests, _settings.rate_limit_window_seconds)
chat_limiter = RateLimiter(_settings.rate_limit_requests * 3, _settings.rate_limit_window_seconds)


def client_key(request: Request) -> str:
    # Render and most PaaS put the real client IP first in X-Forwarded-For.
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
