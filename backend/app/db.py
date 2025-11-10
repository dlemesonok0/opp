import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://appuser:apppass@db:5432/appdb"
)

engine = create_engine(DATABASE_URL, echo=False, future=True)


def init_db():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pings (
                id SERIAL PRIMARY KEY,
                message TEXT NOT NULL
            );
        """))