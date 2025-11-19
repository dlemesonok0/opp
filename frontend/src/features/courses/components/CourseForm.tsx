import { useEffect, useState } from "react";
import type { Course, CoursePayload } from "../api/courseApi";

type CourseFormProps = {
  initialCourse?: Course | null;
  onSubmit: (payload: CoursePayload) => void;
  onCancel?: () => void;
  loading?: boolean;
};

const CourseForm = ({ initialCourse, onSubmit, onCancel, loading }: CourseFormProps) => {
  const [title, setTitle] = useState(initialCourse?.title ?? "");

  useEffect(() => {
    setTitle(initialCourse?.title ?? "");
  }, [initialCourse]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) {
      return;
    }
    onSubmit({ title: nextTitle });
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h3>{initialCourse ? "Редактировать предмет" : "Новый предмет"}</h3>
      <div className="form-field">
        <label htmlFor="course-title">Название</label>
        <input
          id="course-title"
          className="input"
          placeholder="Например, Проектный практикум"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div className="form-actions">
        {initialCourse && (
          <button className="ghost-btn" type="button" onClick={onCancel}>
            Отмена
          </button>
        )}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>
    </form>
  );
};

export default CourseForm;
