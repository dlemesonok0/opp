import { type FormEvent, useEffect, useState } from "react";
import type { Project } from "../api/projectApi";

export type ProjectFormValues = {
  title: string;
  description: string;
  outcomeDescription: string;
  outcomeAcceptanceCriteria: string;
  outcomeDeadline: string;
  outcomeResult: string;
};

type ProjectFormProps = {
  mode: "create" | "edit";
  initialProject?: Project | null;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel?: () => void;
  loading?: boolean;
};

const emptyValues: ProjectFormValues = {
  title: "",
  description: "",
  outcomeDescription: "",
  outcomeAcceptanceCriteria: "",
  outcomeDeadline: "",
  outcomeResult: "",
};

const toInputValue = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
};

const ProjectForm = ({
  mode,
  initialProject,
  onSubmit,
  onCancel,
  loading,
}: ProjectFormProps) => {
  const [values, setValues] = useState<ProjectFormValues>({ ...emptyValues });
  const [showExtras, setShowExtras] = useState(false);

  useEffect(() => {
    if (initialProject) {
      setValues({
        title: initialProject.title,
        description: initialProject.description,
        outcomeDescription: initialProject.outcome.description,
        outcomeAcceptanceCriteria: initialProject.outcome.acceptance_criteria,
        outcomeDeadline: toInputValue(initialProject.outcome.deadline),
        outcomeResult: initialProject.outcome.result ?? "",
      });
      setShowExtras(true);
    } else {
      setValues({ ...emptyValues });
      setShowExtras(false);
    }
  }, [initialProject]);

  const updateField = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
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
      <button
        className="ghost-btn"
        type="button"
        onClick={() => setShowExtras((prev) => !prev)}
        style={{ alignSelf: "flex-start" }}
      >
        {showExtras ? "Скрыть дополнительные поля" : "Дополнительно (необязательно)"}
      </button>
      {showExtras && (
        <>
          <div className="form-field">
            <label htmlFor="project-description">Описание</label>
            <textarea
              id="project-description"
              className="input"
              rows={3}
              value={values.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Коротко о проекте (необязательно)"
            />
          </div>
          <div className="form-field">
            <label htmlFor="outcome-description">Описание результата</label>
            <textarea
              id="outcome-description"
              className="input"
              rows={3}
              value={values.outcomeDescription}
              onChange={(event) => updateField("outcomeDescription", event.target.value)}
              placeholder="Что получится в итоге (необязательно)"
            />
          </div>
          <div className="form-field">
            <label htmlFor="outcome-criteria">Критерии приемки</label>
            <textarea
              id="outcome-criteria"
              className="input"
              rows={2}
              value={values.outcomeAcceptanceCriteria}
              onChange={(event) => updateField("outcomeAcceptanceCriteria", event.target.value)}
              placeholder="Как поймём, что задача выполнена (необязательно)"
            />
          </div>
          <div className="form-field">
            <label htmlFor="outcome-result">Фактический результат (ссылка или текст)</label>
            <textarea
              id="outcome-result"
              className="input"
              rows={2}
              value={values.outcomeResult}
              onChange={(event) => updateField("outcomeResult", event.target.value)}
              placeholder="Ссылка на коммит, деплой или описание фактического результата"
            />
          </div>
        </>
      )}
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
