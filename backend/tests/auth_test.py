def _register(client, email, password):
    return client.post("/auth/register", json={"email": email, "password": password})


def _login(client, email, password):
    return client.post(
        "/auth/token",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


def test_register_and_login(client):
    email = "user1@example.com"
    password = "Passw0rd1"

    res = _register(client, email, password)
    assert res.status_code == 201
    assert res.json()["email"] == email

    login_res = _login(client, email, password)
    assert login_res.status_code == 200
    tokens = login_res.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens

    bad_login = _login(client, email, "Wrongpass1")
    assert bad_login.status_code == 401


def test_register_duplicate(client):
    email = "dup@example.com"
    password = "Passw0rd1"

    first = _register(client, email, password)
    assert first.status_code == 201

    second = _register(client, email, password)
    assert second.status_code == 400


def test_refresh_rotates_and_revokes(client):
    email = "refresh@example.com"
    password = "Passw0rd1"

    _register(client, email, password)
    login_res = _login(client, email, password)
    tokens = login_res.json()

    old_refresh = tokens["refresh_token"]
    refresh_res = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert refresh_res.status_code == 200
    new_tokens = refresh_res.json()
    assert new_tokens["refresh_token"] != old_refresh

    old_refresh_again = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert old_refresh_again.status_code == 401


def test_logout_revokes_refresh(client):
    email = "logout@example.com"
    password = "Passw0rd1"

    _register(client, email, password)
    login_res = _login(client, email, password)
    tokens = login_res.json()

    logout_res = client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert logout_res.status_code == 200

    refresh_res = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh_res.status_code == 401
