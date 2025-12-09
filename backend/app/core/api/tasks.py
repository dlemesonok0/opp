from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from app.core.models.course import Project
from app.auth.api.deps import get_current_user
from app.core.models.task import Task, OutcomeTask, Dependency, TaskAssignee
from app.core.models.review import ReviewTask
from app.core.models.users import Membership, User
from app.core.models.comments import Comment
from app.core.models.enums import DepType, CompletionRule, TaskStatus
from app.core.schemas.top_schemas import (
    TaskOut,
    TaskCreate,
    TaskUpdate,
    ReviewTaskOut,
    ReviewCreate,
    CommentOut,
    CommentCreate,
)
from app.db import get_db

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])

def _ensure_same_project_or_404(db: Session, project_id: UUID):
    proj = db.get(Project, project_id)
    if not proj:
        raise HTTPException(404, "Project not found")
    return proj

def _child_must_fit_parent_window(parent_task: Task, start_dt, end_dt):
    parent_start = parent_task.planned_start
    parent_end = parent_task.deadline or parent_task.planned_end

    if parent_start and start_dt and start_dt < parent_start:
        raise HTTPException(400, "Subtask must start after parent starts")
    if parent_end and end_dt and end_dt > parent_end:
        raise HTTPException(400, "Subtask must finish before parent ends")
    if parent_end and start_dt and start_dt >= parent_end:
        raise HTTPException(400, "Subtask must start before parent ends")


def _recalculate_project_schedule(db: Session, project_id: UUID):
    """Simple recalculation to enforce base rules."""
    project = db.get(Project, project_id)
    project_deadline = project.outcome.deadline if project and project.outcome else None
    tasks = (
        db.query(Task)
        .filter(Task.project_id == project_id, Task.status != TaskStatus.Done)
        .all()
    )
    by_id = {t.id: t for t in tasks}
    deps = (
        db.query(Dependency)
        .join(Task, Dependency.successor_task_id == Task.id)
        .filter(Task.project_id == project_id, Task.status != TaskStatus.Done)
        .all()
    )
    deps_by_successor = {}
    deps_by_pred = {}
    for dep in deps:
        deps_by_successor.setdefault(dep.successor_task_id, []).append(dep)
        deps_by_pred.setdefault(dep.predecessor_task_id, []).append(dep)

    def ensure_times(task: Task):
        # duration хранится в днях; переводим в часы для расчётов
        dur_hours = max(float(task.duration or 0) * 24.0, 1.0 / 60.0)
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
            if parent:
                parent_start = parent.planned_start
                parent_end = parent.deadline or parent.planned_end

                if parent_start and start and start < parent_start:
                    start = parent_start
                    end = start + timedelta(hours=dur_hours)

                if parent_end and end and end > parent_end:
                    end = parent_end
                    start = end - timedelta(hours=dur_hours)

                if parent_start and start and start < parent_start:
                    start = parent_start
                    if end and end < start:
                        end = start

        dep_start_constraint = None
        dep_end_constraint = None
        for dep in deps_by_successor.get(task.id, []):
            pred = by_id.get(dep.predecessor_task_id)
            if not pred:
                pred = db.get(Task, dep.predecessor_task_id)
                if not pred or pred.project_id != project_id:
                    continue
            pred_start = pred.planned_start
            pred_end = pred.deadline or pred.planned_end
            lag_delta = timedelta(hours=float(dep.lag or 0))
            if dep.type == DepType.FS and pred_end:
                candidate = pred_end + lag_delta
                dep_start_constraint = candidate if dep_start_constraint is None else max(dep_start_constraint, candidate)
            elif dep.type == DepType.SS and pred_start:
                candidate = pred_start + lag_delta
                dep_start_constraint = candidate if dep_start_constraint is None else max(dep_start_constraint, candidate)
            elif dep.type == DepType.FF and pred_end:
                candidate = pred_end + lag_delta
                dep_end_constraint = candidate if dep_end_constraint is None else max(dep_end_constraint, candidate)
            elif dep.type == DepType.SF and pred_start:
                candidate = pred_start + lag_delta
                dep_end_constraint = candidate if dep_end_constraint is None else max(dep_end_constraint, candidate)

        if dep_start_constraint and (not start or start < dep_start_constraint):
            start = dep_start_constraint
            end = start + timedelta(hours=dur_hours)

        if dep_end_constraint and (not end or end < dep_end_constraint):
            end = dep_end_constraint
            start = end - timedelta(hours=dur_hours)

        if end and start and end < start:
            end = start

        if project_deadline and end and end > project_deadline:
            end = project_deadline
            start = end - timedelta(hours=dur_hours)

        # Re-assert dependency constraints after deadline clamp
        if dep_start_constraint and start and start < dep_start_constraint:
            start = dep_start_constraint
            end = start + timedelta(hours=dur_hours)

        if dep_end_constraint and end and end < dep_end_constraint:
            end = dep_end_constraint
            start = end - timedelta(hours=dur_hours)

        task.planned_start = start
        task.planned_end = end

    # Build simple topological order to process predecessors first when possible
    indeg = {t.id: 0 for t in tasks}
    for succ_id, dep_list in deps_by_successor.items():
        indeg[succ_id] = indeg.get(succ_id, 0) + len(dep_list)
    queue = [tid for tid, d in indeg.items() if d == 0]
    topo: list[UUID] = []
    while queue:
        cur = queue.pop(0)
        topo.append(cur)
        for dep in deps_by_pred.get(cur, []):
            succ = dep.successor_task_id
            indeg[succ] -= 1
            if indeg[succ] == 0:
                queue.append(succ)
    if len(topo) != len(tasks):
        # Cycle detected; fallback to original order
        topo = [t.id for t in tasks]

    # Apply dependency propagation multiple passes to stabilize schedules
    ordered_tasks = [by_id[tid] for tid in topo]
    for _ in range(max(1, len(tasks) * 2)):
        before = [(t.id, t.planned_start, t.deadline or t.planned_end) for t in ordered_tasks]
        for t in ordered_tasks:
            ensure_times(t)
        after = [(t.id, t.planned_start, t.deadline or t.planned_end) for t in ordered_tasks]
        if before == after:
            break

    db.flush()

def _resolve_assignees(
    db: Session, project: Project, assignee_ids: Optional[List[UUID]]
) -> List[tuple[UUID, UUID]]:
    """
    Accepts a mix of user ids, membership ids, and the project team id and returns unique (user_id, membership_id).
    Только члены команды проекта. Team id разворачивается в membership текущей команды.
    """
    if not assignee_ids:
        return []

    if not project.team_id:
        raise HTTPException(400, "Task assignees require the project to have a team")

    resolved: List[tuple[UUID, UUID]] = []
    seen = set()
    team_memberships: Optional[List[Membership]] = None

    for raw_id in assignee_ids:
        if project.team_id and raw_id == project.team_id:
            if team_memberships is None:
                team_memberships = db.query(Membership).filter(Membership.team_id == project.team_id).all()
                if not team_memberships:
                    raise HTTPException(400, "Project team has no members to assign")
            for m in team_memberships:
                if m.user_id and m.user_id not in seen:
                    seen.add(m.user_id)
                    resolved.append((m.user_id, m.id))
            continue

        # Membership id?
        membership = db.get(Membership, raw_id)
        if membership:
            if project.team_id and membership.team_id != project.team_id:
                raise HTTPException(400, "Membership must belong to the project team")
            if membership.user_id and membership.user_id not in seen:
                seen.add(membership.user_id)
                resolved.append((membership.user_id, membership.id))
            continue

        user = db.get(User, raw_id)
        if not user:
            raise HTTPException(400, "Assignee must be an existing user or the project team")
        if user.id not in seen:
            seen.add(user.id)
            mrow = (
                db.query(Membership.id)
                .filter(Membership.team_id == project.team_id, Membership.user_id == user.id)
                .first()
            )
            if not mrow:
                raise HTTPException(400, "Assignee must be a member of the project team")
            membership_id = mrow[0]
            resolved.append((user.id, membership_id))

    return resolved

def _ensure_dependency_exists(
    db: Session, predecessor_id: UUID, successor_id: UUID, dep_type: DepType, lag: int = 0
) -> None:
    exists = (
        db.query(Dependency)
        .filter(
            Dependency.predecessor_task_id == predecessor_id,
            Dependency.successor_task_id == successor_id,
        )
        .first()
    )
    if exists:
        exists.type = dep_type
        exists.lag = lag
    else:
        db.add(
            Dependency(
                predecessor_task_id=predecessor_id,
                successor_task_id=successor_id,
                type=dep_type,
                lag=lag,
            )
        )

def _clamp_child_to_parent_window(parent_task: Task, start_dt, end_dt, duration_hours: float):
    parent_start = parent_task.planned_start
    parent_end = parent_task.deadline or parent_task.planned_end

    if parent_start and start_dt and start_dt < parent_start:
        start_dt = parent_start
        end_dt = start_dt + timedelta(hours=duration_hours)

    if parent_end and end_dt and end_dt > parent_end:
        end_dt = parent_end
        start_dt = end_dt - timedelta(hours=duration_hours)
        if parent_start and start_dt < parent_start:
            start_dt = parent_start
            end_dt = start_dt + timedelta(hours=duration_hours)

    return start_dt, end_dt


def _apply_dependency_constraints(
    task: Task, deps: list[Dependency], db: Session
) -> tuple[datetime | None, datetime | None]:
    """Return adjusted (start, end) that satisfy dependency lags for the task."""
    dep_start_constraint = None
    dep_end_constraint = None
    for dep in deps:
        pred = db.get(Task, dep.predecessor_task_id)
        if not pred:
            continue
        pred_start = pred.planned_start
        pred_end = pred.deadline or pred.planned_end
        lag_delta = timedelta(hours=float(dep.lag or 0))

        if dep.type == DepType.FS and pred_end:
            candidate = pred_end + lag_delta
            dep_start_constraint = candidate if dep_start_constraint is None else max(dep_start_constraint, candidate)
        elif dep.type == DepType.SS and pred_start:
            candidate = pred_start + lag_delta
            dep_start_constraint = candidate if dep_start_constraint is None else max(dep_start_constraint, candidate)
        elif dep.type == DepType.FF and pred_end:
            candidate = pred_end + lag_delta
            dep_end_constraint = candidate if dep_end_constraint is None else max(dep_end_constraint, candidate)
        elif dep.type == DepType.SF and pred_start:
            candidate = pred_start + lag_delta
            dep_end_constraint = candidate if dep_end_constraint is None else max(dep_end_constraint, candidate)

    duration_hours = max(float(task.duration or 0) * 24.0, 1.0 / 60.0)
    dur_delta = timedelta(hours=duration_hours)

    start = task.planned_start
    end = task.deadline or task.planned_end

    if not start and end:
        start = end - dur_delta
    elif start and not end:
        end = start + dur_delta

    if dep_start_constraint and start and start < dep_start_constraint:
        start = dep_start_constraint
        end = start + dur_delta

    if dep_end_constraint and end and end < dep_end_constraint:
        end = dep_end_constraint
        start = end - dur_delta

    if end and start and end < start:
        end = start

    return start, end


def _apply_completion_rule(db: Session, task: Task, now: datetime):
    """Update task status according to its completion rule and assignee progress."""
    if task.actual_start is None:
        task.actual_start = now

    if task.completion_rule == CompletionRule.AnyOne:
        task.status = TaskStatus.Done
        task.actual_end = task.actual_end or now
        return

    if task.completion_rule == CompletionRule.AllAssignees:
        total = db.query(TaskAssignee).filter(TaskAssignee.task_id == task.id).count()
        completed = (
            db.query(TaskAssignee)
            .filter(TaskAssignee.task_id == task.id, TaskAssignee.is_completed.is_(True))
            .count()
        )
        if total > 0 and completed == total:
            task.status = TaskStatus.Done
            task.actual_end = task.actual_end or now
        elif task.status == TaskStatus.Planned:
            task.status = TaskStatus.InProgress

@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(project_id: UUID, payload: TaskCreate, db: Session = Depends(get_db)):
    project = _ensure_same_project_or_404(db, project_id)

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
        result=payload.outcome.result,
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
        deadline=payload.deadline,
        auto_scheduled=payload.autoScheduled,
        completion_rule=payload.completionRule,
        outcome_task_id=ot.id,
    )
    db.add(task)
    db.flush()

    deps_to_create: List[Dependency] = []
    dep_pairs = set()

    def _queue_dependency(predecessor_id: UUID, successor_id: UUID, dep_type: DepType, lag: int = 0):
        pair = (predecessor_id, successor_id)
        if pair in dep_pairs:
            return
        dep_pairs.add(pair)
        deps_to_create.append(
            Dependency(
                predecessor_task_id=predecessor_id,
                successor_task_id=successor_id,
                type=dep_type,
                lag=lag,
            )
        )

    # If this is a subtask, make it start after the parent and finish before the parent ends.
    if parent_id:
        _child_must_fit_parent_window(parent, task.planned_start, task.deadline or task.planned_end)
        _queue_dependency(parent_id, task.id, DepType.SS, 0)
        _queue_dependency(task.id, parent_id, DepType.FF, 0)

    if payload.dependencies:
        for dep in payload.dependencies:
            pred = db.get(Task, dep.predecessorId)
            if not pred or pred.project_id != project_id:
                raise HTTPException(400, "dependency predecessor must be in the same project")
            _queue_dependency(dep.predecessorId, task.id, dep.type, dep.lag)

    if deps_to_create:
        db.add_all(deps_to_create)
    assignees = _resolve_assignees(db, project, payload.assigneeIds)
    for user_id, membership_id in assignees:
        db.add(TaskAssignee(task_id=task.id, user_id=user_id, membership_id=membership_id))
    db.commit()
    db.refresh(task)
    return task

@router.get("", response_model=List[TaskOut])
def list_tasks(project_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    _ensure_same_project_or_404(db, project_id)
    q = (
        db.query(Task)
        .options(selectinload(Task.reviews))
        .filter(Task.project_id == project_id)
        .order_by(Task.planned_start)
        .limit(limit)
        .offset(offset)
    )
    return q.all()

@router.post("/recalculate", response_model=List[TaskOut])
def recalc_tasks(project_id: UUID, db: Session = Depends(get_db)):
    _ensure_same_project_or_404(db, project_id)
    _recalculate_project_schedule(db, project_id)
    db.commit()
    return (
        db.query(Task)
        .options(selectinload(Task.reviews))
        .filter(Task.project_id == project_id)
        .order_by(Task.planned_start)
        .all()
    )

plain_router = APIRouter(prefix="/tasks", tags=["tasks"])

@plain_router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: UUID, db: Session = Depends(get_db)):
    obj = (
        db.query(Task)
        .options(selectinload(Task.reviews))
        .filter(Task.id == task_id)
        .first()
    )
    if not obj:
        raise HTTPException(404, "Task not found")
    return obj

@plain_router.patch("/{task_id}", response_model=TaskOut)
def update_task(task_id: UUID, payload: TaskUpdate, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "Task not found")
    project = _ensure_same_project_or_404(db, t.project_id)
    previous_parent_id = t.parent_id
    duration_changed = False
    deadline_provided = "deadline" in payload.model_fields_set
    planned_start_provided = "plannedStart" in payload.model_fields_set
    planned_end_provided = "plannedEnd" in payload.model_fields_set

    if payload.parentId is not None:
        if payload.parentId:
            parent = db.get(Task, payload.parentId)
            if not parent or parent.project_id != t.project_id:
                raise HTTPException(400, "parentId must refer to a task within the same project")
            t.parent_id = parent.id
        else:
            t.parent_id = None
        pass

    current_parent_id = t.parent_id
    if payload.parentId is not None and previous_parent_id and previous_parent_id != current_parent_id:
        db.query(Dependency).filter(
            Dependency.predecessor_task_id == previous_parent_id,
            Dependency.successor_task_id == t.id,
        ).delete()
        db.query(Dependency).filter(
            Dependency.predecessor_task_id == t.id,
            Dependency.successor_task_id == previous_parent_id,
        ).delete()
        pass

    if payload.title is not None:
        t.title = payload.title
    if payload.description is not None:
        t.description = payload.description
    if payload.duration is not None:
        t.duration = payload.duration
        duration_changed = True
    if planned_start_provided and payload.plannedStart is not None:
        t.planned_start = payload.plannedStart
    if planned_end_provided and payload.plannedEnd is not None:
        if payload.plannedStart is None and t.planned_start and payload.plannedEnd < t.planned_start:
            raise HTTPException(400, "plannedEnd must be >= plannedStart")
        t.planned_end = payload.plannedEnd
    if deadline_provided:
        t.deadline = payload.deadline
    if payload.autoScheduled is not None:
        t.auto_scheduled = payload.autoScheduled
    if payload.completionRule is not None:
        t.completion_rule = payload.completionRule
    if payload.outcomeResult is not None:
        t.outcome.result = payload.outcomeResult

    duration_hours = max(float(t.duration or 0) * 24.0, 1.0 / 60.0)
    dur_delta = timedelta(hours=duration_hours)

    if planned_start_provided and t.planned_start and not planned_end_provided:
        t.planned_end = t.planned_start + dur_delta
    elif planned_end_provided and t.planned_end and not planned_start_provided:
        t.planned_start = t.planned_end - dur_delta
    elif duration_changed:
        if t.planned_start:
            t.planned_end = t.planned_start + dur_delta
        elif t.planned_end:
            t.planned_start = t.planned_end - dur_delta

    if t.planned_start and t.planned_end and t.planned_end < t.planned_start:
        t.planned_end = t.planned_start

    # Apply predecessor constraints to keep task within dependency windows.
    dep_rows = (
        db.query(Dependency)
        .filter(Dependency.successor_task_id == t.id)
        .all()
    )
    if dep_rows:
        dep_start_constraint = None
        dep_end_constraint = None
        for dep in dep_rows:
            pred = db.get(Task, dep.predecessor_task_id)
            if not pred:
                continue
            pred_start = pred.planned_start
            pred_end = pred.deadline or pred.planned_end
            lag_delta = timedelta(hours=float(dep.lag or 0))

            if dep.type == DepType.FS and pred_end:
                candidate = pred_end + lag_delta
                dep_start_constraint = candidate if dep_start_constraint is None else max(dep_start_constraint, candidate)
            elif dep.type == DepType.SS and pred_start:
                candidate = pred_start + lag_delta
                dep_start_constraint = candidate if dep_start_constraint is None else max(dep_start_constraint, candidate)
            elif dep.type == DepType.FF and pred_end:
                candidate = pred_end + lag_delta
                dep_end_constraint = candidate if dep_end_constraint is None else max(dep_end_constraint, candidate)
            elif dep.type == DepType.SF and pred_start:
                candidate = pred_start + lag_delta
                dep_end_constraint = candidate if dep_end_constraint is None else max(dep_end_constraint, candidate)

        duration_hours = max(float(t.duration or 0) * 24.0, 1.0 / 60.0)
        dur_delta = timedelta(hours=duration_hours)
        start = t.planned_start
        end = t.deadline or t.planned_end
        if not start and end:
            start = end - dur_delta
        elif start and not end:
            end = start + dur_delta

        if dep_start_constraint and start and start < dep_start_constraint:
            start = dep_start_constraint
            end = start + dur_delta

        if dep_end_constraint and end and end < dep_end_constraint:
            end = dep_end_constraint
            start = end - dur_delta

        if end and start and end < start:
            end = start

        t.planned_start = start
        t.planned_end = end

    parent_for_deps = db.get(Task, t.parent_id) if t.parent_id else None
    if payload.dependencies is not None:
        # replace dependencies where this task is successor
        db.query(Dependency).filter(Dependency.successor_task_id == t.id).delete()
        if t.parent_id:
            db.query(Dependency).filter(
                Dependency.predecessor_task_id == t.id,
                Dependency.successor_task_id == t.parent_id,
            ).delete()
        deps_to_create: List[Dependency] = []
        dep_pairs = set()

        def _queue_dependency(predecessor_id: UUID, successor_id: UUID, dep_type: DepType, lag: int = 0):
            pair = (predecessor_id, successor_id)
            if pair in dep_pairs:
                return
            dep_pairs.add(pair)
            deps_to_create.append(
                Dependency(
                    predecessor_task_id=predecessor_id,
                    successor_task_id=successor_id,
                    type=dep_type,
                    lag=lag,
                )
            )

        if parent_for_deps:
            _queue_dependency(parent_for_deps.id, t.id, DepType.SS, 0)
            _queue_dependency(t.id, parent_for_deps.id, DepType.FF, 0)
        for dep in payload.dependencies:
            pred = db.get(Task, dep.predecessorId)
            if not pred or pred.project_id != t.project_id:
                raise HTTPException(400, "dependency predecessor must be in the same project")
            _queue_dependency(dep.predecessorId, t.id, dep.type, dep.lag)

        if deps_to_create:
            db.add_all(deps_to_create)
        active_deps = deps_to_create
    else:
        if parent_for_deps:
            _ensure_dependency_exists(db, parent_for_deps.id, t.id, DepType.SS, 0)
            _ensure_dependency_exists(db, t.id, parent_for_deps.id, DepType.FF, 0)
        active_deps = (
            db.query(Dependency)
            .filter(Dependency.successor_task_id == t.id)
            .all()
        )
    if payload.assigneeIds is not None:
        db.query(TaskAssignee).filter(TaskAssignee.task_id == t.id).delete()
        assignees = _resolve_assignees(db, project, payload.assigneeIds)
        for user_id, membership_id in assignees:
            db.add(TaskAssignee(task_id=t.id, user_id=user_id, membership_id=membership_id))

    # Пересчёт окна задачи из длительности: при смене дедлайна/старта/длительности
    dep_list = active_deps if payload.dependencies is not None else (
        db.query(Dependency).filter(Dependency.successor_task_id == t.id).all()
    )
    if dep_list:
        dep_start, dep_end = _apply_dependency_constraints(t, dep_list, db)
        t.planned_start = dep_start
        t.planned_end = dep_end

    if t.parent_id and parent_for_deps:
        child_end = t.deadline or t.planned_end
        child_start = t.planned_start
        duration_hours = max(float(t.duration or 0) * 24.0, 1.0 / 60.0)
        child_start, child_end = _clamp_child_to_parent_window(parent_for_deps, child_start, child_end, duration_hours)
        t.planned_start = child_start
        t.planned_end = child_end

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


@plain_router.post("/{task_id}/reviews", response_model=ReviewTaskOut, status_code=status.HTTP_201_CREATED)
def add_task_reviewer(task_id: UUID, payload: ReviewCreate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    reviewer: User | None = None
    if payload.reviewerId:
        reviewer = db.get(User, payload.reviewerId)
    elif payload.reviewerEmail:
        reviewer = db.query(User).filter(User.email == payload.reviewerEmail).first()
    if not reviewer:
        raise HTTPException(404, "User not found")

    existing = (
        db.query(ReviewTask)
        .filter(ReviewTask.task_id == task_id, ReviewTask.reviewer_id == reviewer.id)
        .first()
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Reviewer already assigned to this task")

    review = ReviewTask(
        task_id=task_id,
        reviewer_id=reviewer.id,
        comment=payload.comment,
        com_reviewer=payload.comReviewer,
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@plain_router.get("/{task_id}/comments", response_model=List[CommentOut])
def list_task_comments(task_id: UUID, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return (
        db.query(Comment)
        .options(selectinload(Comment.author))
        .filter(Comment.task_id == task_id)
        .order_by(Comment.created_at.asc())
        .all()
    )


@plain_router.post("/{task_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_task_comment(
    task_id: UUID,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    comment = Comment(task_id=task_id, text=payload.text, project_id=task.project_id, author_id=current_user.id)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@plain_router.post("/{task_id}/complete", response_model=TaskOut)
def complete_task_for_assignee(
    task_id: UUID,
    payload: dict | None = Body(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    assignees_q = db.query(TaskAssignee).filter(TaskAssignee.task_id == task.id)
    total_assignees = assignees_q.count()

    # If no assignees, allow the caller to complete directly.
    assignee = None
    if total_assignees == 0:
        pass
    else:
        assignee = assignees_q.filter(TaskAssignee.user_id == current_user.id).first()
        if not assignee:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not assigned to this task")

    now = datetime.utcnow()
    if assignee and not assignee.is_completed:
        assignee.is_completed = True
        assignee.completed_at = now
        db.flush()  # ensure updated flags are visible for completion rule checks

    if payload and isinstance(payload, dict):
        result = payload.get("result")
        if result is not None:
            task.outcome.result = result

    if total_assignees == 0:
        if task.actual_start is None:
            task.actual_start = now
        task.status = TaskStatus.Done
        task.actual_end = task.actual_end or now
    else:
        _apply_completion_rule(db, task, now)
    db.commit()
    db.refresh(task)
    return task
