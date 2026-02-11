from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_register_wrong_creds():
    r = client.post("auth/register", json={
        "email": "qwerty",
        "password": "123456",
    })

    assert r.status_code == 422

def test_register_positive():
    r = client.post("auth/register", json={
        "email": "qwer@qwerty.com",
        "password": "qyu347#IUJNK",
    })

    assert r.status_code == 400

def test_get_token():
    response = client.post(
        "/auth/token",
        data={
            "grant_type": "password",
            "username": "qwer@qwerty.com",
            "password": "qyu347#IUJNK",
            "scope": "",
            "client_id": "string",
            "client_secret": "********",
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    assert response.status_code == 200
    body = response.json()

    assert "access_token" in body
    assert body["token_type"] == "bearer"