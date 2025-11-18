from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.core.models.course import Course, OutcomeProject, Project
from app.core.models.users import Team
from app.core.schemas.top_schemas import ProjectOut, ProjectCreate, ProjectUpdate
from app.db import get_db

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    if payload.courseId and not db.get(Course, payload.courseId):
        raise HTTPException(404, "Course not found")
    if payload.teamId and not db.get(Team, payload.teamId):
        raise HTTPException(404, "Team not found")

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
):
    query = db.query(Project)
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
def get_project(project_id: UUID, db: Session = Depends(get_db)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj

@router.patch("/{project_id}", response_model=ProjectOut)
def update_project(project_id: UUID, payload: ProjectUpdate, db: Session = Depends(get_db)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    if payload.title is not None:
        proj.title = payload.title
    if payload.description is not None:
        proj.description = payload.description
    if payload.courseId is not None:
        if payload.courseId and not db.get(Course, payload.courseId):
            raise HTTPException(404, "Course not found")
        proj.course_id = payload.courseId
    if payload.teamId is not None:
        if payload.teamId and not db.get(Team, payload.teamId):
            raise HTTPException(404, "Team not found")
        proj.team_id = payload.teamId
    db.commit()
    db.refresh(proj)
    return proj

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: UUID, db: Session = Depends(get_db)):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    db.delete(proj)
    db.commit()
