import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.crud.user import create_user
from app.schemas.auth import UserOut, UserCreate
from app.db import get_db
from app.crud.user import authenticate_user, get_user_by_email
from app.crud import refresh_token as refresh_crud
from app.core.security import (
    create_access_token,
    create_refresh_token,
)
from app.schemas.auth import TokenPair, RefreshRequest
from jose import jwt, JWTError
from app.core.security import SECRET_KEY, ALGORITHM

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserOut, status_code=201)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    user = get_user_by_email(db, user_in.email)
    if user:
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    user = create_user(db, user_in.email, user_in.password)
    return user

@router.post("/token", response_model=TokenPair)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные",
        )

    access = create_access_token(sub=user.email)
    jti = str(uuid.uuid4())
    refresh = create_refresh_token(sub=user.email, jti=jti)

    refresh_crud.create_refresh_token(db, user_id=user.id, jti=jti)

    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
def refresh_tokens(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
):
    token = payload.refresh_token
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if data.get("type") != "refresh":
        raise HTTPException(status_code=400, detail="Not a refresh token")

    jti = data.get("jti")
    sub = data.get("sub")
    if not jti or not sub:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if refresh_crud.is_refresh_revoked(db, jti):
        raise HTTPException(status_code=401, detail="Refresh token revoked")

    user = get_user_by_email(db, sub)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access = create_access_token(sub=user.email)

    new_jti = str(uuid.uuid4())
    new_refresh = create_refresh_token(sub=user.email, jti=new_jti)
    refresh_crud.create_refresh_token(db, user_id=user.id, jti=new_jti)

    refresh_crud.revoke_refresh_token(db, jti)

    return TokenPair(access_token=access, refresh_token=new_refresh)

@router.post("/logout")
def logout(
    payload: RefreshRequest,
    db: Session = Depends(get_db),
):
    try:
        data = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    jti = data.get("jti")
    if not jti:
        raise HTTPException(status_code=400, detail="No jti in token")

    refresh_crud.revoke_refresh_token(db, jti)
    return {"detail": "logged out"}

