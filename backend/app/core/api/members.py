from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.core import models
from app.core.schemas.top_schemas import (
    TeamMemberAdd,
    UserInTeamOut,
)

router = APIRouter(prefix="/teams", tags=["teams"])

@router.post(
    "/{team_id}/members",
    status_code=status.HTTP_201_CREATED,
)
def add_member_to_team(
    team_id: UUID,
    payload: TeamMemberAdd,
    db: Session = Depends(get_db),
):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    user = db.get(models.User, payload.userId)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        db.query(models.Membership)
        .filter(
            models.Membership.team_id == team_id,
            models.Membership.user_id == payload.userId,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already a member of this team",
        )

    membership = models.Membership(
        team_id=team_id,
        user_id=payload.userId,
    )
    db.add(membership)
    db.commit()
    return {"team_id": str(team_id), "user_id": str(payload.userId)}


@router.get(
    "/{team_id}/members",
    response_model=List[UserInTeamOut],
)
def list_team_members(
    team_id: UUID,
    db: Session = Depends(get_db),
):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    users = (
        db.query(models.User)
        .join(models.Membership, models.Membership.user_id == models.User.id)
        .filter(models.Membership.team_id == team_id)
        .order_by(models.User.full_name)
        .all()
    )
    return users


@router.delete(
    "/{team_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_member_from_team(
    team_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    membership = (
        db.query(models.Membership)
        .filter(
            models.Membership.team_id == team_id,
            models.Membership.user_id == user_id,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this team",
        )

    db.delete(membership)
    db.commit()