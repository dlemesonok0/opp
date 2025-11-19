from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, field_validator
from uuid import UUID

class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class CourseCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)

class CourseUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)

class CourseOut(ORM):
    id: UUID
    title: str

class OutcomeProjectIn(BaseModel):
    description: str
    acceptanceCriteria: str
    deadline: datetime

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

class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str
    courseId: Optional[UUID] = None
    teamId: Optional[UUID] = None
    outcome: OutcomeProjectIn

class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    courseId: Optional[UUID] = None
    teamId: Optional[UUID] = None

class ProjectOut(ORM):
    id: UUID
    title: str
    description: str
    course_id: Optional[UUID] = None
    team_id: Optional[UUID] = None
    outcome: OutcomeProjectOut


class ProjectMembershipOut(ProjectOut):
    team_name: str | None = None
    course_title: str | None = None

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str
    duration: int = Field(ge=0)
    plannedStart: datetime
    plannedEnd: datetime
    isMilestone: bool = False
    completionRule: str = Field(pattern="^(AnyOne|AllAssignees)$")
    parentId: Optional[UUID] = None
    outcome: OutcomeTaskIn

    @field_validator("plannedEnd")
    @classmethod
    def _end_not_before_start(cls, v: datetime, values):
        start = values.get("plannedStart")
        if start and v < start:
            raise ValueError("plannedEnd must be >= plannedStart")
        return v

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    duration: Optional[int] = Field(default=None, ge=0)
    plannedStart: Optional[datetime] = None
    plannedEnd: Optional[datetime] = None
    isMilestone: Optional[bool] = None
    completionRule: Optional[str] = Field(default=None, pattern="^(AnyOne|AllAssignees)$")
    parentId: Optional[UUID] = None

    @field_validator("plannedEnd")
    @classmethod
    def _upd_end_not_before_start(cls, v: Optional[datetime], values):
        start = values.get("plannedStart")
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
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    is_milestone: bool
    completion_rule: str
    outcome: OutcomeTaskOut


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
    full_name: str
    email: str
