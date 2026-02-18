def test_register_wrong_creds(client):
    r = client.post("/auth/register", json={
        "email": "qwerty",
        "password": "123456",
    })

    assert r.status_code == 422

def test_register_positive(client):
    r = client.post("/auth/register", json={
        "email": "qwer@qwerty.com",
        "password": "qyu347#IUJNK",
    })

    assert r.status_code == 201

    dup = client.post("/auth/register", json={
        "email": "qwer@qwerty.com",
        "password": "qyu347#IUJNK",
    })
    assert dup.status_code == 400

def test_get_token(client):
    client.post("/auth/register", json={
        "email": "qwer@qwerty.com",
        "password": "qyu347#IUJNK",
    })

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
