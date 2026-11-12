"""Domain errors carrying a safe, user-facing Arabic message."""
from __future__ import annotations


class AppError(Exception):
    """An error whose message is safe to show to the end user."""

    def __init__(self, message: str, code: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code
