from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db import init_db, engine, Base
from sqlalchemy import text

from .auth.api import auth, users

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(auth.router)
app.include_router(users.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/ping")
def ping():
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO pings (message) VALUES ('pong')"))
        rows = conn.execute(text("SELECT COUNT(*) FROM pings")).scalar()
    return {"status": "ok", "pings_in_db": rows}