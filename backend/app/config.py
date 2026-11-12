"""Application configuration loaded from environment variables.

Secrets (OPENAI_API_KEY) are read only on the server and never sent to the client.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return default


@dataclass(frozen=True)
class Settings:
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", "").strip())
    openai_model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", "gpt-4o").strip())
    openai_chat_model: str = field(
        default_factory=lambda: os.getenv("OPENAI_CHAT_MODEL", "").strip() or os.getenv("OPENAI_MODEL", "gpt-4o").strip()
    )
    openai_timeout_seconds: int = field(default_factory=lambda: _int("OPENAI_TIMEOUT_SECONDS", 60))

    # Demo mode returns a fixed sample analysis when no API key is configured.
    demo_mode: bool = field(default_factory=lambda: _bool("DEMO_MODE", False))

    max_upload_mb: int = field(default_factory=lambda: _int("MAX_UPLOAD_MB", 8))
    max_image_side_px: int = field(default_factory=lambda: _int("MAX_IMAGE_SIDE_PX", 1600))

    # Simple per-IP rate limit (requests per window).
    rate_limit_requests: int = field(default_factory=lambda: _int("RATE_LIMIT_REQUESTS", 20))
    rate_limit_window_seconds: int = field(default_factory=lambda: _int("RATE_LIMIT_WINDOW_SECONDS", 600))

    allowed_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()
        )
    )

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    @property
    def ai_enabled(self) -> bool:
        return bool(self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
