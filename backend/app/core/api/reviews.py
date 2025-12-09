from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.auth.api.deps import get_current_user
from app.core.models.review import ReviewTask, ReviewProject
from app.core.models.task import Task
from app.core.models.course import Project
from app.core.models.users import User
from app.core.schemas.top_schemas import (
    ReviewTaskWithTask,
    ReviewProjectWithProject,
    ReviewUpdate,
    TaskOut,
    ProjectOut,
)
from app.db import get_db

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/tasks", response_model=List[ReviewTaskWithTask])
def list_task_reviews(
    status_filter: Optional[str] = Query(default=None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(ReviewTask, Task, Project.title)
        .join(Task, Task.id == ReviewTask.task_id)
        .join(Project, Project.id == Task.project_id)
        .filter(ReviewTask.reviewer_id == current_user.id)
    )
    if status_filter:
        q = q.filter(ReviewTask.status == status_filter)
    rows = q.order_by(ReviewTask.created_at.desc()).all()
    result: List[ReviewTaskWithTask] = []
    for review, task, project_title in rows:
        setattr(task, "project_title", project_title)
        result.append(
            ReviewTaskWithTask(
                id=review.id,
                task_id=review.task_id,
                reviewer_id=review.reviewer_id,
                status=review.status,
                comment=review.comment,
                created_at=review.created_at,
                task=task,
                project_title=project_title,
            )
        )
    return result


@router.get("/tasks/{review_id}/view", response_model=TaskOut)
def view_task_for_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(ReviewTask, review_id)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.reviewer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")

    task = db.get(Task, review.task_id)
    if not task:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.get("/projects/{review_id}/view", response_model=ProjectOut)
def view_project_for_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(ReviewProject, review_id)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.reviewer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")

    project = db.get(Project, review.project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.patch("/tasks/{review_id}", response_model=ReviewTaskWithTask)
def update_task_review(
    review_id: UUID,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(ReviewTask, review_id)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.reviewer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")

    review.status = payload.status
    review.comment = payload.comment
    review.com_reviewer = payload.comReviewer
    db.commit()
    db.refresh(review)

    task = db.get(Task, review.task_id)
    project_title = None
    if task:
        project = db.get(Project, task.project_id)
        project_title = project.title if project else None
        setattr(task, "project_title", project_title)

    return ReviewTaskWithTask(
        id=review.id,
        task_id=review.task_id,
        reviewer_id=review.reviewer_id,
        status=review.status,
        comment=review.comment,
        com_reviewer=review.com_reviewer,
        created_at=review.created_at,
        task=task,
        project_title=project_title,
    )


@router.get("/tasks/{review_id}", response_model=ReviewTaskWithTask)
def get_task_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(ReviewTask, review_id)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.reviewer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")

    task = db.get(Task, review.task_id)
    project_title = None
    if task:
        project = db.get(Project, task.project_id)
        project_title = project.title if project else None
        setattr(task, "project_title", project_title)

    return ReviewTaskWithTask(
        id=review.id,
        task_id=review.task_id,
        reviewer_id=review.reviewer_id,
        status=review.status,
        comment=review.comment,
        com_reviewer=review.com_reviewer,
        created_at=review.created_at,
        task=task,
        project_title=project_title,
    )


@router.patch("/projects/{review_id}", response_model=ReviewProjectWithProject)
def update_project_review(
    review_id: UUID,
    payload: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(ReviewProject, review_id)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.reviewer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")

    review.status = payload.status
    review.comment = payload.comment
    review.com_reviewer = payload.comReviewer
    db.commit()
    db.refresh(review)

    project = db.get(Project, review.project_id)

    return ReviewProjectWithProject(
        id=review.id,
        project_id=review.project_id,
        reviewer_id=review.reviewer_id,
        status=review.status,
        comment=review.comment,
        com_reviewer=review.com_reviewer,
        created_at=review.created_at,
        project=project,
    )


@router.get("/projects/{review_id}", response_model=ReviewProjectWithProject)
def get_project_review(
    review_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = db.get(ReviewProject, review_id)
    if not review:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")
    if review.reviewer_id != current_user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")

    project = db.get(Project, review.project_id)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    return ReviewProjectWithProject(
        id=review.id,
        project_id=review.project_id,
        reviewer_id=review.reviewer_id,
        status=review.status,
        comment=review.comment,
        com_reviewer=review.com_reviewer,
        created_at=review.created_at,
        project=project,
    )


@router.get("/projects", response_model=List[ReviewProjectWithProject])
def list_project_reviews(
    status_filter: Optional[str] = Query(default=None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(ReviewProject, Project)
        .join(Project, Project.id == ReviewProject.project_id)
        .filter(ReviewProject.reviewer_id == current_user.id)
    )
    if status_filter:
        q = q.filter(ReviewProject.status == status_filter)
    rows = q.order_by(ReviewProject.created_at.desc()).all()
    result: List[ReviewProjectWithProject] = []
    for review, project in rows:
        result.append(
            ReviewProjectWithProject(
                id=review.id,
                project_id=review.project_id,
                reviewer_id=review.reviewer_id,
                status=review.status,
                comment=review.comment,
                com_reviewer=review.com_reviewer,
                created_at=review.created_at,
                project=project,
            )
        )
    return result
