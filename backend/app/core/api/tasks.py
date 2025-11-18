from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.models.course import Project
from app.core.models.task import Task, OutcomeTask
from app.core.schemas.top_schemas import TaskOut, TaskCreate, TaskUpdate
from app.db import get_db

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

def _ensure_same_project_or_404(db: Session, project_id: UUID):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(project_id: UUID, payload: TaskCreate, db: Session = Depends(get_db)):
    _ensure_same_project_or_404(db, project_id)

    parent_id = payload.parentId
    parent = None
    if parent_id:
        parent = db.get(Task, parent_id)
        if not parent or parent.project_id != project_id:
            raise HTTPException(400, "parentId must refer to a task within the same project")

    ot = OutcomeTask(
        description=payload.outcome.description,
        acceptance_criteria=payload.outcome.acceptanceCriteria,
        deadline=payload.outcome.deadline,
    )
    db.add(ot)
    db.flush()

    task = Task(
        project_id=project_id,
        parent_id=parent_id,
        title=payload.title,
        description=payload.description,
        duration=payload.duration,
        planned_start=payload.plannedStart,
        planned_end=payload.plannedEnd,
        is_milestone=payload.isMilestone,
        completion_rule=payload.completionRule,
        outcome_task_id=ot.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.get("", response_model=List[TaskOut])
def list_tasks(project_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    _ensure_same_project_or_404(db, project_id)
    q = (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .order_by(Task.planned_start)
        .limit(limit)
        .offset(offset)
    )
    return q.all()

plain_router = APIRouter(prefix="/tasks", tags=["tasks"])

@plain_router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID, db: Session = Depends(get_db)):
    obj = db.get(Task, task_id)
    if not obj:
        raise HTTPException(404, "Task not found")
    return obj

@plain_router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskUpdate, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found")

    if payload.parentId is not None:
        if payload.parentId:
            parent = db.get(Task, payload.parentId)
            if not parent or parent.project_id != t.project_id:
                raise HTTPException(400, "parentId must refer to a task within the same project")
            t.parent_id = parent.id
        else:
            t.parent_id = None

    if payload.title is not None:
        t.title = payload.title
    if payload.description is not None:
        t.description = payload.description
    if payload.duration is not None:
        t.duration = payload.duration
    if payload.plannedStart is not None:
        t.planned_start = payload.plannedStart
    if payload.plannedEnd is not None:
        if payload.plannedStart is None and t.planned_start and payload.plannedEnd < t.planned_start:
            raise HTTPException(400, "plannedEnd must be >= plannedStart")
        t.planned_end = payload.plannedEnd
    if payload.isMilestone is not None:
        t.is_milestone = payload.isMilestone
    if payload.completionRule is not None:
        t.completion_rule = payload.completionRule

    db.commit()
    db.refresh(t)
    return t

@plain_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: UUID, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found")
    db.delete(t)
    db.commit()
