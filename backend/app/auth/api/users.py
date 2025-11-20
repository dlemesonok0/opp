from typing import List

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.auth.api.deps import get_current_user
from app.auth.schemas.auth import UserOut
from app.core.models.users import Membership, Team, User
from app.core.models.course import Project
from app.core.schemas.top_schemas import ProjectMembershipOut, ProjectOut
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


@router.get("/me/projects", response_model=List[ProjectMembershipOut])
def list_my_projects(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    projects = (
        db.query(Project)
        .join(Team, Project.team_id == Team.id)
        .join(Membership, Membership.team_id == Team.id)
        .options(
            selectinload(Project.outcome),
            selectinload(Project.course),
            selectinload(Project.team),
        )
        .filter(Membership.user_id == current_user.id)
        .order_by(Project.title)
        .all()
    )

    enriched: List[ProjectMembershipOut] = []
    for project in projects:
        base = ProjectOut.model_validate(project)
        enriched.append(
            ProjectMembershipOut(
                **base.model_dump(),
                course_title=project.course.title if project.course else None,
                team_name=project.team.name if project.team else None,
            )
        )
    return enriched
