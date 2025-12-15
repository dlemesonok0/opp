from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from uuid import UUID

from app.auth.api.deps import get_current_user
from app.core.models.course import OutcomeProject, Project
from app.core.models.review import ReviewProject
from app.core.models.users import Membership, Team, User
from app.core.schemas.top_schemas import (
    ProjectOut,
    ProjectCreate,
    ProjectUpdate,
    ReviewProjectOut,
    ReviewCreate,
)
from app.db import get_db

router = APIRouter(prefix="/projects", tags=["projects"])


def _require_membership(db: Session, team_id: UUID, user_id: UUID, action: str) -> Membership:
    membership = (
        db.query(Membership)
        .filter(Membership.team_id == team_id, Membership.user_id == user_id)
        .first()
    )
    if not membership:
        raise HTTPException(403, f"You are not allowed to {action} this project")
    return membership

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.teamId:
        team = db.get(Team, payload.teamId)
        if not team:
            raise HTTPException(404, "Team not found")
        _require_membership(db, payload.teamId, current_user.id, "create")

    op = OutcomeProject(
        description=payload.outcome.description,
        acceptance_criteria=payload.outcome.acceptanceCriteria,
        deadline=payload.outcome.deadline,
        result=payload.outcome.result,
    )
    db.add(op)
    db.flush()

    proj = Project(
        title=payload.title,
        description=payload.description,
        team_id=payload.teamId,
        outcome_project_id=op.id,
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj

@router.get("", response_model=List[ProjectOut])
def list_projects(
    teamId: Optional[UUID] = None,
    q: Optional[str] = Query(default=None, description="search in title/description"),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Project)
        .options(selectinload(Project.reviews).selectinload(ReviewProject.reviewer))
        .join(Membership, Membership.team_id == Project.team_id)
        .filter(Membership.user_id == current_user.id)
    )
    if teamId:
        query = query.filter(Project.team_id == teamId)
    if q:
        ilike = f"%{q}%"
        query = query.filter(
            (Project.title.ilike(ilike)) | (Project.description.ilike(ilike))
        )
    return query.order_by(Project.title).limit(limit).offset(offset).all()

@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = (
        db.query(Project)
        .options(selectinload(Project.reviews).selectinload(ReviewProject.reviewer))
        .filter(Project.id == project_id)
        .first()
    )
    if not proj:
        raise HTTPException(404, "Project not found")
    if not proj.team_id:
        raise HTTPException(403, "Project has no team; only team members can view it")
    _require_membership(db, proj.team_id, current_user.id, "view")
    return proj

@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    if proj.team_id:
        _require_membership(db, proj.team_id, current_user.id, "update")
    elif payload.teamId is None:
        raise HTTPException(403, "Project has no team; only team members can edit it")
    if payload.title is not None:
        proj.title = payload.title
    if payload.description is not None:
        proj.description = payload.description
    if payload.teamId is not None:
        if payload.teamId:
            if not db.get(Team, payload.teamId):
                raise HTTPException(404, "Team not found")
                _require_membership(db, payload.teamId, current_user.id, "update")
        proj.team_id = payload.teamId
    if payload.outcome:
        if payload.outcome.description is not None:
            proj.outcome.description = payload.outcome.description
        if payload.outcome.acceptanceCriteria is not None:
            proj.outcome.acceptance_criteria = payload.outcome.acceptanceCriteria
        if payload.outcome.deadline is not None:
            proj.outcome.deadline = payload.outcome.deadline
        if payload.outcome.result is not None:
            proj.outcome.result = payload.outcome.result
    db.commit()
    db.refresh(proj)
    # ensure reviews are loaded for serializers
    db.refresh(proj, attribute_names=["reviews"])
    return proj

@router.post("/{project_id}/reviews", response_model=ReviewProjectOut, status_code=status.HTTP_201_CREATED)
def add_project_reviewer(
    project_id: UUID,
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    if proj.team_id:
        _require_membership(db, proj.team_id, current_user.id, "add reviewer")

    reviewer: User | None = None
    if payload.reviewerId:
        reviewer = db.get(User, payload.reviewerId)
    elif payload.reviewerEmail:
        reviewer = db.query(User).filter(User.email == payload.reviewerEmail).first()
    if not reviewer:
        raise HTTPException(404, "User not found")

    exists = (
        db.query(ReviewProject)
        .filter(ReviewProject.project_id == project_id, ReviewProject.reviewer_id == reviewer.id)
        .first()
    )
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reviewer already assigned to this project")

    review = ReviewProject(
        project_id=project_id,
        reviewer_id=reviewer.id,
        comment=payload.comment,
        com_reviewer=payload.comReviewer,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")

    if not proj.team_id:
        raise HTTPException(403, "Project has no team; only team members can delete it")

    _require_membership(db, proj.team_id, current_user.id, "delete")

    db.delete(proj)
    db.commit()
