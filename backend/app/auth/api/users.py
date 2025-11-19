from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.api.deps import get_current_user
from app.auth.schemas.auth import UserOut
from app.core.models.users import User
from app.db import get_db

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=List[UserOut])
def search_users(
    search: str = Query("", min_length=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(User)
    if search:
        query = query.filter(func.lower(User.email).like(f"%{search.lower()}%"))
    return query.order_by(User.email).limit(limit).all()


@router.get("/me", response_model=UserOut)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user
