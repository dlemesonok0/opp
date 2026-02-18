import datetime as dt
import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import event, text


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or "sqlite:///./test_sql_app.db"

os.environ["DATABASE_URL"] = TEST_DATABASE_URL

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import Base, engine, init_db
import app.core.models
import app.auth.models.refresh_token
from app.main import app
from fastapi.testclient import TestClient


if engine.dialect.name == "sqlite":
    @event.listens_for(engine, "connect")
    def _sqlite_now(dbapi_connection, _):
        dbapi_connection.create_function("now", 0, lambda: dt.datetime.utcnow().isoformat(" "))


@pytest.fixture(scope="session", autouse=True)
def _create_schema():
    Base.metadata.create_all(bind=engine)
    init_db()
    yield


@pytest.fixture(autouse=True)
def _cleanup_db():
    yield
    tables = list(Base.metadata.tables.keys())
    tables.append("pings")
    if engine.dialect.name == "sqlite":
        with engine.begin() as conn:
            conn.execute(text("PRAGMA foreign_keys=OFF"))
            for name in reversed(tables):
                conn.execute(text(f'DELETE FROM "{name}"'))
            conn.execute(text("PRAGMA foreign_keys=ON"))
        return

    joined = ", ".join(f'"{name}"' for name in tables)
    if not joined:
        return
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {joined} RESTART IDENTITY CASCADE"))


@pytest.fixture()
def client():
    with TestClient(app) as client:
        yield client
