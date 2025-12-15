import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, DateTime, func, Enum, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models.base import Base
from app.core.models.enums import ReviewStatus


class ReviewProject(Base):
    __tablename__ = "review_projects"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus, name="review_status"), default=ReviewStatus.Pending,
                                                 nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=True)
    com_reviewer: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship(back_populates="reviews_projects")

    @property
    def reviewer_email(self) -> str | None:
        return self.reviewer.email if self.reviewer else None

    @property
    def reviewer_name(self) -> str | None:
        if not self.reviewer:
            return None
        return self.reviewer.full_name or self.reviewer.email


class ReviewTask(Base):
    __tablename__ = "review_tasks"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus, name="review_status"), default=ReviewStatus.Pending,
                                                 nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=True)
    com_reviewer: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task: Mapped["Task"] = relationship(back_populates="reviews")
    reviewer: Mapped["User"] = relationship(back_populates="reviews_tasks")

    @property
    def reviewer_email(self) -> str | None:
        return self.reviewer.email if self.reviewer else None

    @property
    def reviewer_name(self) -> str | None:
        if not self.reviewer:
            return None
        return self.reviewer.full_name or self.reviewer.email
