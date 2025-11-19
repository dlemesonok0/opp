import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base, DeclarativeBase
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str =  os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres@db:5432/postgres")

settings = Settings()

engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def init_db():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS pings (
                id SERIAL PRIMARY KEY,
                message TEXT NOT NULL
            );
        """))

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()