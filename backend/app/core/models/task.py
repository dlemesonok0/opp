import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    String,
    UniqueConstraint,
    ForeignKey,
    DateTime,
    Boolean,
    Text,
    Enum,
    Integer,
    Float,
    CheckConstraint,
    text,
)

from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models.base import Base
from app.core.models.enums import TaskStatus, CompletionRule, DepType
from app.core.models.review import ReviewTask
from app.core.models.comments import Comment


class OutcomeTask(Base):
    __tablename__ = "outcome_tasks"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    acceptance_criteria: Mapped[str] = mapped_column(Text, nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    task: Mapped["Task"] = relationship(back_populates="outcome", uselist=False)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)

    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    children: Mapped[List["Task"]] = relationship(
        back_populates="parent",
        passive_deletes=True,
    )
    parent: Mapped[Optional["Task"]] = relationship(
        back_populates="children",
        remote_side="Task.id",
        passive_deletes=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus, name="task_status"), default=TaskStatus.Planned,
                                               nullable=False)
    duration: Mapped[float] = mapped_column(Float, nullable=False)

    outcome_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("outcome_tasks.id", ondelete="RESTRICT"), nullable=False
    )

    planned_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    planned_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    auto_scheduled: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"), nullable=False)

    completion_rule: Mapped[CompletionRule] = mapped_column(
        Enum(CompletionRule, name="completion_rule"), default=CompletionRule.AllAssignees, nullable=False
    )

    project: Mapped["Project"] = relationship(back_populates="tasks")
    outcome: Mapped["OutcomeTask"] = relationship(back_populates="task")
    comments: Mapped[List["Comment"]] = relationship(back_populates="task", cascade="all, delete-orphan")

    assignees: Mapped[List["TaskAssignee"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    reviews: Mapped[List["ReviewTask"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    predecessors: Mapped[List["Dependency"]] = relationship(
        back_populates="successor",
        foreign_keys="Dependency.successor_task_id",
        passive_deletes=True,
        viewonly=True,
    )
    successors: Mapped[List["Dependency"]] = relationship(
        back_populates="predecessor",
        foreign_keys="Dependency.predecessor_task_id",
        passive_deletes=True,
        viewonly=True,
    )

    @property
    def dependencies(self) -> List["Dependency"]:
        return self.predecessors

    @property
    def assignee_ids(self) -> List[uuid.UUID]:
        return [a.user_id for a in self.assignees]


class TaskAssignee(Base):
    __tablename__ = "task_assignees"

    __table_args__ = (
        UniqueConstraint("task_id", "user_id", name="uq_task_user"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    task: Mapped["Task"] = relationship(back_populates="assignees")
    user: Mapped["User"] = relationship(back_populates="task_assignments")


class Dependency(Base):
    __tablename__ = "dependencies"

    __table_args__ = (
        CheckConstraint("predecessor_task_id <> successor_task_id", name="ck_dep_no_self_link"),
        UniqueConstraint("predecessor_task_id", "successor_task_id", name="uq_dep_pair"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    predecessor_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    successor_task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )

    type: Mapped[DepType] = mapped_column(Enum(DepType, name="dep_type"), nullable=False)
    lag: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    predecessor: Mapped["Task"] = relationship(back_populates="successors", foreign_keys=[predecessor_task_id])
    successor: Mapped["Task"] = relationship(back_populates="predecessors", foreign_keys=[successor_task_id])
