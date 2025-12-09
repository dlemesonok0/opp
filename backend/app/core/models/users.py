import uuid
from datetime import datetime
from typing import List

from sqlalchemy import String, UniqueConstraint, ForeignKey, DateTime, func, Column, Boolean, Enum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models.base import Base
from app.core.models.enums import InviteStatus


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column("full_name", String(200), nullable=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)

    memberships: Mapped[List["Membership"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    reviews_projects: Mapped[List["ReviewProject"]] = relationship(back_populates="reviewer")
    reviews_tasks: Mapped[List["ReviewTask"]] = relationship(back_populates="reviewer")
    task_assignments: Mapped[List["TaskAssignee"]] = relationship(back_populates="user")
    comments: Mapped[List["Comment"]] = relationship(back_populates="author", cascade="all, delete-orphan")

    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    memberships: Mapped[List["Membership"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    projects: Mapped[List["Project"]] = relationship(back_populates="team")
    invites: Mapped[List["TeamInvite"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class Membership(Base):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "team_id", name="uq_membership_user_team"),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="memberships")
    team: Mapped["Team"] = relationship(back_populates="memberships")


class TeamInvite(Base):
    __tablename__ = "team_invites"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    invited_email: Mapped[str] = mapped_column(String(320), nullable=False)
    invited_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[InviteStatus] = mapped_column(Enum(InviteStatus), default=InviteStatus.Pending, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    team: Mapped["Team"] = relationship(back_populates="invites")
    invited_user: Mapped["User"] = relationship()



