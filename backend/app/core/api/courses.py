from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.core.models.course import Course
from app.core.schemas.top_schemas import CourseCreate, CourseOut, CourseUpdate
from app.db import get_db

router = APIRouter(prefix="/courses", tags=["courses"])

@router.post("", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, db: Session = Depends(get_db)):
    existing = db.query(Course).filter(Course.title == payload.title).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Курс с таким названием уже существует"
        )

    obj = Course(title=payload.title)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.get("", response_model=List[CourseOut])
def list_courses(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    q = db.query(Course).order_by(Course.title).limit(limit).offset(offset)
    return q.all()

@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: UUID, db: Session = Depends(get_db)):
    obj = db.get(Course, course_id)
    if not obj:
        raise HTTPException(404, "Course not found")
    return obj

@router.patch("/{course_id}", response_model=CourseOut)
def update_course(course_id: UUID, payload: CourseUpdate, db: Session = Depends(get_db)):
    obj = db.get(Course, course_id)
    if not obj:
        raise HTTPException(404, "Course not found")
    if payload.title is not None:
        obj.title = payload.title
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: UUID, db: Session = Depends(get_db)):
    obj = db.get(Course, course_id)
    if not obj:
        raise HTTPException(404, "Course not found")
    db.delete(obj)
    db.commit()
