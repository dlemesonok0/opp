from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from datetime import datetime, timedelta

from app.core.models.course import Project
from app.core.models.task import Task, OutcomeTask, Dependency, TaskAssignee
from app.core.models.enums import DepType
from app.core.schemas.top_schemas import TaskOut, TaskCreate, TaskUpdate
from app.db import get_db

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

def _ensure_same_project_or_404(db: Session, project_id: UUID):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj


def _recalculate_project_schedule(db: Session, project_id: UUID):
    """Simple recalculation to enforce base rules."""
    tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id)
        .all()
    )
    by_id = {t.id: t for t in tasks}

    def ensure_times(task: Task):
        dur_hours = max(float(task.duration or 0), 1.0)
        start = task.planned_start
        end = task.deadline or task.planned_end

        if not start and not end:
            end = datetime.utcnow()
            start = end - timedelta(hours=dur_hours)
        elif start and not end:
            end = start + timedelta(hours=dur_hours)
        elif end and not start:
            start = end - timedelta(hours=dur_hours)

        if task.parent_id:
            parent = by_id.get(task.parent_id)
            if parent and parent.planned_start:
                latest_end = parent.planned_start - timedelta(minutes=30)
                if end and end > latest_end:
                    end = latest_end
                    start = end - timedelta(hours=dur_hours)

        if end and start and end < start:
            end = start

        task.planned_start = start
        task.planned_end = end
        task.deadline = task.deadline or end

    for t in tasks:
        ensure_times(t)

    db.flush()

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(project_id: UUID, payload: TaskCreate, db: Session = Depends(get_db)):
    _ensure_same_project_or_404(db, project_id)

    parent_id = payload.parentId
    parent = None
    if parent_id:
        parent = db.get(Task, parent_id)
        if not parent or parent.project_id != project_id:
            raise HTTPException(400, "parentId must refer to a task within the same project")

    def _child_should_end_before_parent(parent_task: Task, end_dt):
        if end_dt and parent_task.planned_start and end_dt > parent_task.planned_start:
            raise HTTPException(400, "Subtask must finish before parent starts")

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
        deadline=payload.deadline or payload.plannedEnd,
        auto_scheduled=payload.autoScheduled,
        is_milestone=payload.isMilestone,
        completion_rule=payload.completionRule,
        outcome_task_id=ot.id,
    )
    db.add(task)
    db.flush()

    # если указали родителя — делаем зависимость FS: родитель после подзадачи
    if parent_id:
        _child_should_end_before_parent(parent, task.deadline or task.planned_end)
        db.add(
          Dependency(
            predecessor_task_id=task.id,
            successor_task_id=parent_id,
            type=DepType.FS,
            lag=0,
          )
        )

    if payload.dependencies:
        for dep in payload.dependencies:
            pred = db.get(Task, dep.predecessorId)
            if not pred or pred.project_id != project_id:
                raise HTTPException(400, "dependency predecessor must be in the same project")
            db.add(
                Dependency(
                    predecessor_task_id=dep.predecessorId,
                    successor_task_id=task.id,
                    type=dep.type,
                    lag=dep.lag,
                )
            )
    if payload.assigneeIds:
        for user_id in payload.assigneeIds:
            db.add(TaskAssignee(task_id=task.id, user_id=user_id))
    _recalculate_project_schedule(db, project_id)
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
    if payload.deadline is not None:
        t.deadline = payload.deadline
    if payload.isMilestone is not None:
        t.is_milestone = payload.isMilestone
    if payload.autoScheduled is not None:
        t.auto_scheduled = payload.autoScheduled
    if payload.completionRule is not None:
        t.completion_rule = payload.completionRule
    if payload.dependencies is not None:
        # replace dependencies where this task is successor
        db.query(Dependency).filter(Dependency.successor_task_id == t.id).delete()
        for dep in payload.dependencies:
            pred = db.get(Task, dep.predecessorId)
            if not pred or pred.project_id != t.project_id:
                raise HTTPException(400, "dependency predecessor must be in the same project")
            db.add(
                Dependency(
                    predecessor_task_id=dep.predecessorId,
                    successor_task_id=t.id,
                    type=dep.type,
                    lag=dep.lag,
                )
            )
    if payload.assigneeIds is not None:
        db.query(TaskAssignee).filter(TaskAssignee.task_id == t.id).delete()
        for user_id in payload.assigneeIds:
            db.add(TaskAssignee(task_id=t.id, user_id=user_id))

    if t.parent_id:
        parent = db.get(Task, t.parent_id)
        if parent:
            child_end = t.deadline or t.planned_end
            if child_end and parent.planned_start and child_end > parent.planned_start:
                raise HTTPException(400, "Subtask must finish before parent starts")

    _recalculate_project_schedule(db, t.project_id)
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
