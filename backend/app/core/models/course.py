import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import String, ForeignKey, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models.base import Base


class OutcomeProject(Base):
    __tablename__ = "outcome_projects"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    acceptance_criteria: Mapped[str] = mapped_column(Text, nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="outcome", uselist=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)

    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("teams.id"), nullable=True)
    outcome_project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("outcome_projects.id", ondelete="RESTRICT"), nullable=False
    )

    team: Mapped[Optional["Team"]] = relationship(back_populates="projects")
    outcome: Mapped["OutcomeProject"] = relationship(back_populates="project")
    tasks: Mapped[List["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    attachments: Mapped[List["Attachment"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    comments: Mapped[List["Comment"]] = relationship(back_populates="project", cascade="all, delete-orphan")

    reviews: Mapped[List["ReviewProject"]] = relationship(back_populates="project", cascade="all, delete-orphan")
