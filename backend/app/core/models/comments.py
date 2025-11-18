import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, DateTime, func, CheckConstraint, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.models.base import Base


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        CheckConstraint(
            "(task_id IS NOT NULL) OR (project_id IS NOT NULL)",
            name="ck_comment_target_present"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    task: Mapped[Optional["Task"]] = relationship(back_populates="comments")
    project: Mapped[Optional["Project"]] = relationship(back_populates="comments")


class Attachment(Base):
    __tablename__ = "attachments"
    __table_args__ = (
        CheckConstraint(
            "(task_id IS NOT NULL) OR (project_id IS NOT NULL)",
            name="ck_attachment_target_present"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    url: Mapped[str] = mapped_column(String(1024), nullable=False)
    external_id: Mapped[Optional[str]] = mapped_column(String(255))

    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    task: Mapped[Optional["Task"]] = relationship(back_populates="attachments")
    project: Mapped[Optional["Project"]] = relationship(back_populates="attachments")
