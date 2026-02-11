import os

import pytest
from sqlalchemy import text


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.skip("TEST_DATABASE_URL is not set", allow_module_level=True)

os.environ["DATABASE_URL"] = TEST_DATABASE_URL

from app.db import Base, engine, init_db  # noqa: E402
import app.core.models  # noqa: F401,E402
import app.auth.models.refresh_token  # noqa: F401,E402
from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


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
    joined = ", ".join(f'"{name}"' for name in tables)
    if not joined:
        return
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE {joined} RESTART IDENTITY CASCADE"))


@pytest.fixture()
def client():
    with TestClient(app) as client:
        yield client
