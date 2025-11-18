from sqlalchemy.orm import Session
from app.auth.models.refresh_token import RefreshToken

def create_refresh_token(db: Session, user_id: str, jti: str) -> RefreshToken:
    obj = RefreshToken(user_id=user_id, jti=jti)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

def revoke_refresh_token(db: Session, jti: str):
    token = db.query(RefreshToken).filter_by(jti=jti).first()
    if token:
        token.is_revoked = True
        db.commit()

def is_refresh_revoked(db: Session, jti: str) -> bool:
    token = db.query(RefreshToken).filter_by(jti=jti).first()
    if not token:
        return True
    return token.is_revoked