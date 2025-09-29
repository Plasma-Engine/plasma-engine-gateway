"""
Main application entrypoint for the Gateway service.

This FastAPI app provides baseline operational endpoints required by
PE-101 acceptance criteria:
  - /health: shallow liveness probe to confirm the process is running
  - /ready: readiness probe to ensure dependencies/config load
  - /metrics: Prometheus exposition endpoint for scraping

Structure follows the proposed layout:
  app/
    api/v1/
    core/
    models/

Notes for contributors:
  - Prefer explicit, well-named functions and dataclasses/models.
  - Keep business logic out of route handlers; use services/modules.
  - When adding new dependencies, pin versions in requirements.txt.
  - Write high-signal docstrings explaining WHY, not HOW.
"""

from fastapi import FastAPI
from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Gauge, generate_latest
from starlette.responses import Response

from app.core.config import get_application_settings
from app.core.logging import get_logger, setup_logging

# Initialize logging on module load
setup_logging()
logger = get_logger(__name__)


def create_app() -> FastAPI:
    """Create and configure the FastAPI application instance.

    Returns
    -------
    FastAPI
        Configured FastAPI app with metadata and base routes registered.
    """
    settings = get_application_settings()

    app = FastAPI(
        title="Plasma Engine Gateway",
        version=settings.version,
        docs_url="/docs",
        openapi_url="/openapi.json",
        description=(
            "API Gateway for the Plasma Engine platform. "
            "Provides unified ingress, authn/z, observability, and federation."
        ),
    )

    # Basic in-process health gauges. In production, prefer a shared registry.
    registry = CollectorRegistry()
    readiness_gauge = Gauge("gateway_readiness", "Readiness state", registry=registry)
    liveness_gauge = Gauge("gateway_liveness", "Liveness state", registry=registry)

    # Initialize gauges to healthy. Handlers update if checks fail.
    readiness_gauge.set(1)
    liveness_gauge.set(1)

    @app.get("/health", tags=["ops"])  # Shallow liveness
    def health() -> dict[str, str]:
        """Return basic liveness signal.

        Keep this extremely lightweight so orchestrators (e.g., k8s) can probe
        frequently without imposing load.
        """
        return {"status": "ok"}

    @app.get("/ready", tags=["ops"])  # Deeper readiness
    def ready() -> dict[str, str]:
        """Return readiness signal based on configuration checks.

        Extend this to validate external dependencies (DB, Redis, etc.).
        """
        try:
            # Minimal readiness: application settings can be loaded.
            _ = get_application_settings()
            readiness_gauge.set(1)
            return {"status": "ready"}
        except Exception as e:
            # Log the exception for debugging in production
            logger.error(f"Readiness check failed: {e}", exc_info=True)
            readiness_gauge.set(0)
            return {"status": "not_ready", "error": str(type(e).__name__)}

    @app.get("/metrics", tags=["ops"])  # Prometheus exposition
    def metrics() -> Response:
        """Expose Prometheus metrics for scraping.

        For multi-process deployments, prefer Prometheus client multiprocess
        mode and a shared directory for metrics.
        """
        data = generate_latest(registry)
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)

    # In later tickets, include API routers here (e.g., auth, admin, etc.)
    # from app.api.v1.routes import api_router
    # app.include_router(api_router, prefix="/api/v1")

    return app


app = create_app()

