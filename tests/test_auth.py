import os
from fastapi.testclient import TestClient

os.environ.setdefault("JWT_SECRET", "dev-secret-key")
os.environ.setdefault("REDIS_URL", "fakeredis://")

from app.main import app  # noqa: E402


client = TestClient(app)


def test_token_and_me_flow():
    # Obtain tokens via password flow
    resp = client.post(
        "/api/v1/auth/token",
        data={"username": "user", "password": "user123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "access_token" in body and "refresh_token" in body

    # Access protected endpoint
    me = client.get("/api/v1/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200, me.text
    assert me.json()["user"] == "user"

    # Refresh token
    ref = client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert ref.status_code == 200, ref.text
    assert ref.json()["access_token"]

