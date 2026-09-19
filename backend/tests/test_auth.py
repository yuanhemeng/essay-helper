from fastapi.testclient import TestClient

from app.main import app


def test_register_and_me() -> None:
    with TestClient(app) as client:
        register = client.post(
            "/api/v1/auth/register",
            json={
                "email": "researcher@example.com",
                "password": "strong-password",
                "display_name": "研究者",
            },
        )
        assert register.status_code == 201
        token = register.json()["access_token"]

        me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["email"] == "researcher@example.com"
