from datetime import datetime, timedelta


def _register(client, email, password):
    return client.post("/auth/register", json={"email": email, "password": password})


def _login(client, email, password):
    return client.post(
        "/auth/token",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _create_team(client, name):
    res = client.post("/teams", json={"name": name})
    assert res.status_code == 201
    return res.json()


def _add_member(client, team_id, user_id):
    res = client.post(f"/teams/{team_id}/members", json={"userId": user_id})
    assert res.status_code == 201
    return res.json()


def _project_payload(team_id):
    deadline = (datetime.utcnow() + timedelta(days=30)).isoformat()
    return {
        "title": "Project Alpha",
        "description": "Project description",
        "teamId": team_id,
        "outcome": {
            "description": "Deliverable",
            "acceptanceCriteria": "Done",
            "deadline": deadline,
            "result": None,
        },
    }


def _create_project(client, token, team_id):
    payload = _project_payload(team_id)
    res = client.post("/projects", headers=_auth_headers(token), json=payload)
    assert res.status_code == 201
    return res.json()


def test_create_project_requires_membership(client):
    email = "proj@example.com"
    password = "Passw0rd1"
    user = _register(client, email, password).json()
    tokens = _login(client, email, password).json()

    team = _create_team(client, "Team A")
    payload = _project_payload(team["id"])

    forbidden = client.post("/projects", headers=_auth_headers(tokens["access_token"]), json=payload)
    assert forbidden.status_code == 403

    _add_member(client, team["id"], user["id"])
    allowed = client.post("/projects", headers=_auth_headers(tokens["access_token"]), json=payload)
    assert allowed.status_code == 201


def test_list_projects_filters_by_membership(client):
    user_a = _register(client, "a@example.com", "Passw0rd1").json()
    tokens_a = _login(client, "a@example.com", "Passw0rd1").json()

    user_b = _register(client, "b@example.com", "Passw0rd1").json()
    tokens_b = _login(client, "b@example.com", "Passw0rd1").json()

    team_a = _create_team(client, "Team A")
    team_b = _create_team(client, "Team B")

    _add_member(client, team_a["id"], user_a["id"])
    _add_member(client, team_b["id"], user_b["id"])

    project_a = _create_project(client, tokens_a["access_token"], team_a["id"])
    _create_project(client, tokens_b["access_token"], team_b["id"])

    list_res = client.get("/projects", headers=_auth_headers(tokens_a["access_token"]))
    assert list_res.status_code == 200
    projects = list_res.json()
    assert len(projects) == 1
    assert projects[0]["id"] == project_a["id"]
