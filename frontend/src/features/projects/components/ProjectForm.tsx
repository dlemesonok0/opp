import { type FormEvent, useEffect, useState } from "react";
import type { Course } from "../../courses/api/courseApi";
import type { Project } from "../api/projectApi";

export type ProjectFormValues = {
  title: string;
  description: string;
  courseId: string;
  outcomeDescription: string;
  outcomeAcceptanceCriteria: string;
  outcomeDeadline: string;
};

type ProjectFormProps = {
  mode: "create" | "edit";
  courses: Course[];
  initialProject?: Project | null;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel?: () => void;
  loading?: boolean;
};

const emptyValues: ProjectFormValues = {
  title: "",
  description: "",
  courseId: "",
  outcomeDescription: "",
  outcomeAcceptanceCriteria: "",
  outcomeDeadline: "",
};

const ProjectForm = ({
  mode,
  courses,
  initialProject,
  onSubmit,
  onCancel,
  loading,
}: ProjectFormProps) => {
  const [values, setValues] = useState<ProjectFormValues>({ ...emptyValues });

  useEffect(() => {
    if (initialProject) {
      setValues({
        title: initialProject.title,
        description: initialProject.description,
        courseId: initialProject.course_id ?? "",
        outcomeDescription: initialProject.outcome.description,
        outcomeAcceptanceCriteria: initialProject.outcome.acceptance_criteria,
        outcomeDeadline: initialProject.outcome.deadline.slice(0, 16),
      });
    } else {
      setValues({ ...emptyValues });
    }
  }, [initialProject]);

  const updateField = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h3>{mode === "create" ? "Новый проект" : "Редактировать проект"}</h3>
      <div className="form-field">
        <label htmlFor="project-title">Название</label>
        <input
          id="project-title"
          className="input"
          value={values.title}
          onChange={(event) => updateField("title", event.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="project-description">Описание</label>
        <textarea
          id="project-description"
          className="input"
          rows={3}
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="project-course">Предмет</label>
        <select
          id="project-course"
          className="input"
          value={values.courseId}
          onChange={(event) => updateField("courseId", event.target.value)}
        >
          <option value="">Не выбрано</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="outcome-description">Ожидаемый результат</label>
        <textarea
          id="outcome-description"
          className="input"
          rows={3}
          value={values.outcomeDescription}
          onChange={(event) => updateField("outcomeDescription", event.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="outcome-criteria">Критерии приёмки</label>
        <textarea
          id="outcome-criteria"
          className="input"
          rows={2}
          value={values.outcomeAcceptanceCriteria}
          onChange={(event) => updateField("outcomeAcceptanceCriteria", event.target.value)}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="outcome-deadline">Дедлайн</label>
        <input
          id="outcome-deadline"
          type="datetime-local"
          className="input"
          value={values.outcomeDeadline}
          onChange={(event) => updateField("outcomeDeadline", event.target.value)}
          required
        />
      </div>
      <div className="form-actions">
        {initialProject && (
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

export default ProjectForm;
