from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator, ValidationInfo
from uuid import UUID
from app.core.models.enums import DepType, ReviewStatus

class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class OutcomeProjectIn(BaseModel):
    description: str
    acceptanceCriteria: str
    deadline: datetime

class OutcomeProjectUpdate(BaseModel):
    description: Optional[str] = None
    acceptanceCriteria: Optional[str] = None
    deadline: Optional[datetime] = None

class OutcomeProjectOut(ORM):
    id: UUID
    description: str
    acceptance_criteria: str
    deadline: datetime

class OutcomeTaskIn(BaseModel):
    description: str
    acceptanceCriteria: str
    deadline: datetime

class OutcomeTaskOut(ORM):
    id: UUID
    description: str
    acceptance_criteria: str
    deadline: datetime

class TaskDependencyIn(BaseModel):
    predecessorId: UUID
    type: DepType
    lag: int = 0


class TaskDependencyOut(ORM):
    id: UUID
    predecessor_task_id: UUID
    successor_task_id: UUID
    type: DepType
    lag: int


class TaskAssigneeOut(ORM):
    id: UUID
    task_id: UUID
    user_id: UUID
    is_completed: bool
    completed_at: Optional[datetime] = None


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str
    teamId: Optional[UUID] = None
    outcome: OutcomeProjectIn

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    teamId: Optional[UUID] = None
    outcome: Optional[OutcomeProjectUpdate] = None

class ProjectOut(ORM):
    id: UUID
    title: str
    description: str
    team_id: Optional[UUID] = None
    outcome: OutcomeProjectOut


class ProjectMembershipOut(ProjectOut):
    team_name: str | None = None

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str
    duration: int = Field(ge=0, default=0)
    plannedStart: datetime
    plannedEnd: datetime
    deadline: Optional[datetime] = None
    isMilestone: bool = False
    autoScheduled: bool = False
    completionRule: str = Field(pattern="^(AnyOne|AllAssignees)$")
    parentId: Optional[UUID] = None
    dependencies: Optional[List["TaskDependencyIn"]] = None
    assigneeIds: Optional[List[UUID]] = None
    outcome: OutcomeTaskIn

    @field_validator("plannedEnd")
    @classmethod
    def _end_not_before_start(cls, v: datetime, info: ValidationInfo):
        start = info.data.get("plannedStart")
        if start and v < start:
            raise ValueError("plannedEnd must be >= plannedStart")
        return v

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    duration: Optional[int] = Field(default=None, ge=0)
    plannedStart: Optional[datetime] = None
    plannedEnd: Optional[datetime] = None
    deadline: Optional[datetime] = None
    isMilestone: Optional[bool] = None
    autoScheduled: Optional[bool] = None
    completionRule: Optional[str] = Field(default=None, pattern="^(AnyOne|AllAssignees)$")
    parentId: Optional[UUID] = None
    dependencies: Optional[List["TaskDependencyIn"]] = None
    assigneeIds: Optional[List[UUID]] = None

    @field_validator("plannedEnd")
    @classmethod
    def _upd_end_not_before_start(cls, v: Optional[datetime], info: ValidationInfo):
        start = info.data.get("plannedStart")
        if start and v and v < start:
            raise ValueError("plannedEnd must be >= plannedStart")
        return v

class TaskOut(ORM):
    id: UUID
    project_id: UUID
    parent_id: Optional[UUID]
    title: str
    description: str
    status: str
    duration: int
    planned_start: datetime
    planned_end: datetime
    deadline: Optional[datetime]
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    is_milestone: bool
    auto_scheduled: bool
    completion_rule: str
    outcome: OutcomeTaskOut
    dependencies: List[TaskDependencyOut] = []
    assignee_ids: List[UUID] = []
    assignees: List[TaskAssigneeOut] = []


class TeamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class TeamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)


class TeamOut(ORM):
    id: UUID
    name: str
    created_at: datetime


class TeamMemberAdd(BaseModel):
    userId: UUID


class UserInTeamOut(ORM):
    id: UUID
    full_name: str | None = None
    email: str


class TeamInviteCreate(BaseModel):
    email: str


class TeamInviteOut(ORM):
    id: UUID
    team_id: UUID
    invited_email: str
    status: str
    created_at: datetime
    team_name: str | None = None


class ReviewCreate(BaseModel):
    reviewerId: Optional[UUID] = None
    reviewerEmail: Optional[str] = None
    comment: Optional[str] = None

class ReviewUpdate(BaseModel):
    status: ReviewStatus
    comment: Optional[str] = None


class ReviewTaskOut(ORM):
    id: UUID
    task_id: UUID
    reviewer_id: UUID
    status: ReviewStatus
    comment: Optional[str] = None
    created_at: datetime


class ReviewProjectOut(ORM):
    id: UUID
    project_id: UUID
    reviewer_id: UUID
    status: ReviewStatus
    comment: Optional[str] = None
    created_at: datetime


class TaskSummary(ORM):
    id: UUID
    title: str
    project_id: UUID
    project_title: Optional[str] = None


class ProjectSummary(ORM):
    id: UUID
    title: str
    team_id: Optional[UUID] = None


class ReviewTaskWithTask(ReviewTaskOut):
    task: TaskSummary


class ReviewProjectWithProject(ReviewProjectOut):
    project: ProjectSummary
