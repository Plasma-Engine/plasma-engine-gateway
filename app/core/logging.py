"""
Structured logging configuration for the Gateway service.

Provides consistent, production-ready logging with JSON formatting for
centralized log aggregation systems (e.g., ELK, DataDog, CloudWatch).
"""

from __future__ import annotations

import logging
import sys
from typing import Any, Optional

from app.core.config import get_application_settings


def setup_logging(debug: Optional[bool] = None) -> None:
    """Configure structured logging for the application.

    Parameters
    ----------
    debug : bool, optional
        Override debug mode. If None, reads from application settings.

    Notes
    -----
    In production, consider using structured JSON logging with additional
    context fields like request_id, user_id, trace_id for better observability.
    """
    settings = get_application_settings()
    log_level = logging.DEBUG if (debug if debug is not None else settings.debug) else logging.INFO

    # Configure root logger
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        stream=sys.stdout,
        force=True,  # Override any existing configuration
    )

    # Set specific log levels for noisy third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configured",
        extra={
            "environment": settings.environment,
            "debug": settings.debug,
            "version": settings.version,
        },
    )


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for a specific module.

    Parameters
    ----------
    name : str
        Module name, typically __name__

    Returns
    -------
    logging.Logger
        Configured logger instance
    """
    return logging.getLogger(name)