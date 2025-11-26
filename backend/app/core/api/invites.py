from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.api.deps import get_current_user
from app.core import models
from app.core.models.enums import InviteStatus
from app.core.schemas.top_schemas import TeamInviteCreate, TeamInviteOut
from app.db import get_db

router = APIRouter(tags=["invites"])


def _require_membership(db: Session, team_id: UUID, user_id: UUID, action: str) -> models.Membership:
    membership = (
        db.query(models.Membership)
        .filter(models.Membership.team_id == team_id, models.Membership.user_id == user_id)
        .first()
    )
    if not membership:
        raise HTTPException(403, f"You are not allowed to {action} for this team")
    return membership


@router.post(
    "/teams/{team_id}/invites",
    response_model=TeamInviteOut,
    status_code=status.HTTP_201_CREATED,
)
def create_invite(
    team_id: UUID,
    payload: TeamInviteCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    _require_membership(db, team_id, current_user.id, "invite users")

    normalized_email = payload.email.strip().lower()
    if (
        db.query(models.Membership)
        .join(models.User, models.User.id == models.Membership.user_id)
        .filter(
            models.Membership.team_id == team_id,
            func.lower(models.User.email) == normalized_email,
        )
        .first()
    ):
        raise HTTPException(status_code=409, detail="User is already a member of this team")

    existing_pending = (
        db.query(models.TeamInvite)
        .filter(
            models.TeamInvite.team_id == team_id,
            func.lower(models.TeamInvite.invited_email) == normalized_email,
            models.TeamInvite.status == InviteStatus.Pending,
        )
        .first()
    )
    if existing_pending:
        raise HTTPException(status_code=409, detail="Invite already sent to this email")

    invited_user = (
        db.query(models.User).filter(func.lower(models.User.email) == normalized_email).first()
    )
    invite = models.TeamInvite(
        team_id=team_id,
        invited_email=normalized_email,
        invited_user_id=invited_user.id if invited_user else None,
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return TeamInviteOut(
        id=invite.id,
        team_id=invite.team_id,
        invited_email=invite.invited_email,
        status=invite.status.value,
        created_at=invite.created_at,
        team_name=team.name,
    )


@router.get(
    "/teams/{team_id}/invites",
    response_model=List[TeamInviteOut],
)
def list_team_invites(
    team_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    team = db.get(models.Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    _require_membership(db, team_id, current_user.id, "view invites")

    invites = (
        db.query(models.TeamInvite)
        .filter(
            models.TeamInvite.team_id == team_id,
            models.TeamInvite.status == InviteStatus.Pending,
        )
        .order_by(models.TeamInvite.created_at.desc())
        .all()
    )
    return [
        TeamInviteOut(
            id=inv.id,
            team_id=inv.team_id,
            invited_email=inv.invited_email,
            status=inv.status.value,
            created_at=inv.created_at,
            team_name=team.name,
        )
        for inv in invites
    ]


@router.post("/invites/{invite_id}/accept", response_model=TeamInviteOut)
def accept_invite(
    invite_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invite = db.get(models.TeamInvite, invite_id)
    if not invite:
        raise HTTPException(404, "Invite not found")
    if invite.status != InviteStatus.Pending:
        raise HTTPException(409, "Invite already processed")

    if invite.invited_email.lower() != current_user.email.lower():
        raise HTTPException(403, "You cannot accept an invite not addressed to you")

    membership = (
        db.query(models.Membership)
        .filter(
            models.Membership.team_id == invite.team_id,
            models.Membership.user_id == current_user.id,
        )
        .first()
    )
    if not membership:
        membership = models.Membership(team_id=invite.team_id, user_id=current_user.id)
        db.add(membership)

    team = db.get(models.Team, invite.team_id)
    response = TeamInviteOut(
        id=invite.id,
        team_id=invite.team_id,
        invited_email=invite.invited_email,
        status=InviteStatus.Accepted.value,
        created_at=invite.created_at,
        team_name=team.name if team else None,
    )
    db.delete(invite)
    db.commit()
    return response


@router.post("/invites/{invite_id}/decline", response_model=TeamInviteOut)
def decline_invite(
    invite_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invite = db.get(models.TeamInvite, invite_id)
    if not invite:
        raise HTTPException(404, "Invite not found")
    if invite.status != InviteStatus.Pending:
        raise HTTPException(409, "Invite already processed")

    if invite.invited_email.lower() != current_user.email.lower():
        raise HTTPException(403, "You cannot decline an invite not addressed to you")

    team = db.get(models.Team, invite.team_id)
    response = TeamInviteOut(
        id=invite.id,
        team_id=invite.team_id,
        invited_email=invite.invited_email,
        status=InviteStatus.Declined.value,
        created_at=invite.created_at,
        team_name=team.name if team else None,
    )
    db.delete(invite)
    db.commit()
    return response


@router.delete("/invites/{invite_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_invite(
    invite_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invite = db.get(models.TeamInvite, invite_id)
    if not invite:
        raise HTTPException(404, "Invite not found")

    # Only members of the team can revoke invites
    _require_membership(db, invite.team_id, current_user.id, "revoke invites")

    if invite.status != InviteStatus.Pending:
        # already handled, simply drop
        db.delete(invite)
        db.commit()
        return

    db.delete(invite)
    db.commit()
