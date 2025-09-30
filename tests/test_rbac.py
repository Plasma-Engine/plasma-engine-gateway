import os
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "dev-secret-key")
os.environ.setdefault("REDIS_URL", "fakeredis://")

from app.main import app  # noqa: E402


client = TestClient(app)


def test_admin_users_requires_permission():
    # Viewer token should be forbidden
    resp = client.post(
        "/api/v1/auth/token",
        data={"username": "user", "password": "user123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token = resp.json()["access_token"]
    forbidden = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token}"})
    assert forbidden.status_code == 403

    # Admin token should pass
    resp2 = client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "admin123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    token2 = resp2.json()["access_token"]
    ok = client.get("/api/v1/admin/users", headers={"Authorization": f"Bearer {token2}"})
    assert ok.status_code == 200
    assert "users" in ok.json()

