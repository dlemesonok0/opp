from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.auth.api.deps import get_current_user
from app.core.models.course import Course, OutcomeProject, Project
from app.core.models.users import Membership, Team, User
from app.core.schemas.top_schemas import ProjectOut, ProjectCreate, ProjectUpdate
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
    if payload.courseId and not db.get(Course, payload.courseId):
        raise HTTPException(404, "Course not found")
    if payload.teamId:
        team = db.get(Team, payload.teamId)
        if not team:
            raise HTTPException(404, "Team not found")
        _require_membership(db, payload.teamId, current_user.id, "create")

    op = OutcomeProject(
        description=payload.outcome.description,
        acceptance_criteria=payload.outcome.acceptanceCriteria,
        deadline=payload.outcome.deadline,
    )
    db.add(op)
    db.flush()

    proj = Project(
        title=payload.title,
        description=payload.description,
        course_id=payload.courseId,
        team_id=payload.teamId,
        outcome_project_id=op.id,
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return proj

@router.get("", response_model=List[ProjectOut])
def list_projects(
    courseId: Optional[UUID] = None,
    teamId: Optional[UUID] = None,
    q: Optional[str] = Query(default=None, description="search in title/description"),
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Project)
        .join(Membership, Membership.team_id == Project.team_id)
        .filter(Membership.user_id == current_user.id)
    )
    if courseId:
        query = query.filter(Project.course_id == courseId)
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
    proj = db.get(Project, project_id)
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
    if payload.courseId is not None:
        if payload.courseId and not db.get(Course, payload.courseId):
            raise HTTPException(404, "Course not found")
        proj.course_id = payload.courseId
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
    db.commit()
    db.refresh(proj)
    return proj

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
