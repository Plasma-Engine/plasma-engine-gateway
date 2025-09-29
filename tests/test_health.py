from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ready():
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json()["status"] in {"ready", "not_ready"}


def test_metrics():
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "gateway_liveness" in response.text
    assert "gateway_readiness" in response.text


def test_metrics_content_type():
    """Verify metrics endpoint returns Prometheus-compatible content type."""
    response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers["content-type"]


def test_metrics_gauge_values():
    """Verify metrics contain expected gauge values."""
    response = client.get("/metrics")
    assert response.status_code == 200
    content = response.text

    # Check that gauges are present and have numeric values
    assert "gateway_liveness" in content
    assert "gateway_readiness" in content

    # Verify gauge values are set (should be 1.0 for healthy service)
    lines = content.split("\n")
    liveness_lines = [line for line in lines if line.startswith("gateway_liveness ")]
    readiness_lines = [line for line in lines if line.startswith("gateway_readiness ")]

    assert len(liveness_lines) > 0, "gateway_liveness gauge value not found"
    assert len(readiness_lines) > 0, "gateway_readiness gauge value not found"
