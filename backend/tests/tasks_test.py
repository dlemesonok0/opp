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
    res = client.post("/projects", headers=_auth_headers(token), json=_project_payload(team_id))
    assert res.status_code == 201
    return res.json()


def _task_payload(
    title,
    start,
    end,
    completion_rule="AllAssignees",
    parent_id=None,
    assignee_ids=None,
):
    outcome_deadline = (end + timedelta(days=1)).isoformat()
    payload = {
        "title": title,
        "description": "Task description",
        "duration": 2,
        "plannedStart": start.isoformat(),
        "plannedEnd": end.isoformat(),
        "deadline": None,
        "autoScheduled": False,
        "completionRule": completion_rule,
        "parentId": parent_id,
        "dependencies": None,
        "assigneeIds": assignee_ids,
        "outcome": {
            "description": "Outcome",
            "acceptanceCriteria": "AC",
            "deadline": outcome_deadline,
            "result": None,
        },
    }
    return payload


def test_subtask_must_fit_parent_window(client):
    user = _register(client, "parent@example.com", "Passw0rd1").json()
    tokens = _login(client, "parent@example.com", "Passw0rd1").json()

    team = _create_team(client, "Team A")
    _add_member(client, team["id"], user["id"])

    project = _create_project(client, tokens["access_token"], team["id"])

    parent_start = datetime.utcnow()
    parent_end = parent_start + timedelta(days=2)
    parent_payload = _task_payload("Parent", parent_start, parent_end)
    parent_res = client.post(
        f"/projects/{project['id']}/tasks",
        json=parent_payload,
    )
    assert parent_res.status_code == 201
    parent_id = parent_res.json()["id"]

    child_start = parent_start - timedelta(days=1)
    child_end = parent_start + timedelta(days=1)
    child_payload = _task_payload("Child", child_start, child_end, parent_id=parent_id)
    child_res = client.post(
        f"/projects/{project['id']}/tasks",
        json=child_payload,
    )
    assert child_res.status_code == 400


def test_assignee_team_id_assigns_all_members(client):
    user1 = _register(client, "u1@example.com", "Passw0rd1").json()
    tokens1 = _login(client, "u1@example.com", "Passw0rd1").json()

    user2 = _register(client, "u2@example.com", "Passw0rd1").json()
    _login(client, "u2@example.com", "Passw0rd1")

    team = _create_team(client, "Team A")
    _add_member(client, team["id"], user1["id"])
    _add_member(client, team["id"], user2["id"])

    project = _create_project(client, tokens1["access_token"], team["id"])

    start = datetime.utcnow()
    end = start + timedelta(days=1)
    payload = _task_payload(
        "Task",
        start,
        end,
        assignee_ids=[team["id"]],
    )
    res = client.post(f"/projects/{project['id']}/tasks", json=payload)
    assert res.status_code == 201
    task = res.json()
    assignees = task["assignees"]
    assert len(assignees) == 2
    user_ids = {a["user_id"] for a in assignees}
    assert user1["id"] in user_ids
    assert user2["id"] in user_ids


def test_complete_task_all_assignees_flow(client):
    user1 = _register(client, "c1@example.com", "Passw0rd1").json()
    tokens1 = _login(client, "c1@example.com", "Passw0rd1").json()

    user2 = _register(client, "c2@example.com", "Passw0rd1").json()
    tokens2 = _login(client, "c2@example.com", "Passw0rd1").json()

    team = _create_team(client, "Team A")
    _add_member(client, team["id"], user1["id"])
    _add_member(client, team["id"], user2["id"])

    project = _create_project(client, tokens1["access_token"], team["id"])

    start = datetime.utcnow()
    end = start + timedelta(days=1)
    payload = _task_payload(
        "Task",
        start,
        end,
        completion_rule="AllAssignees",
        assignee_ids=[team["id"]],
    )
    task_res = client.post(f"/projects/{project['id']}/tasks", json=payload)
    assert task_res.status_code == 201
    task_id = task_res.json()["id"]

    first_complete = client.post(
        f"/tasks/{task_id}/complete",
        headers=_auth_headers(tokens1["access_token"]),
    )
    assert first_complete.status_code == 200
    assert first_complete.json()["status"] == "InProgress"

    second_complete = client.post(
        f"/tasks/{task_id}/complete",
        headers=_auth_headers(tokens2["access_token"]),
    )
    assert second_complete.status_code == 200
    assert second_complete.json()["status"] == "Done"
