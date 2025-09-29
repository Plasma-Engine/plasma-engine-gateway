"""
Application configuration utilities for the Gateway service.

Centralizes environment-derived settings and sensible defaults. This module is
intentionally small to keep the boot path minimal and deterministic for
operational probes.
"""

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class ApplicationSettings:
    """Immutable application settings derived from environment variables."""

    environment: str
    version: str
    debug: bool


def _str_to_bool(value: str | None, *, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def get_application_settings() -> ApplicationSettings:
    """Load application settings from environment with defaults.

    Returns
    -------
    ApplicationSettings
        Frozen settings object safe to share across the application.
    """
    environment = os.getenv("APP_ENV", "development")
    version = os.getenv("APP_VERSION", "0.1.0")
    debug = _str_to_bool(os.getenv("APP_DEBUG"), default=(environment != "production"))

    return ApplicationSettings(
        environment=environment,
        version=version,
        debug=debug,
    )

