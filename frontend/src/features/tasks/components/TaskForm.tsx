import { useEffect, useMemo, useState } from "react";
import type { Task } from "../api/taskApi";

export type TaskFormValues = {
  title: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  duration: number;
  completionRule: "AnyOne" | "AllAssignees";
  outcomeDescription: string;
  outcomeAcceptanceCriteria: string;
  outcomeDeadline: string;
  parentId: string;
};

type TaskFormProps = {
  tasks: Task[];
  loading?: boolean;
  initialTask?: Task | null;
  mode?: "create" | "edit";
  onSubmit: (values: TaskFormValues) => void;
};

const emptyValues: TaskFormValues = {
  title: "",
  description: "",
  plannedStart: "",
  plannedEnd: "",
  duration: 1,
  completionRule: "AllAssignees",
  outcomeDescription: "",
  outcomeAcceptanceCriteria: "",
  outcomeDeadline: "",
  parentId: "",
};

const toInputValue = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

const TaskForm = ({ tasks, loading, onSubmit, initialTask = null, mode = "create" }: TaskFormProps) => {
  const [values, setValues] = useState<TaskFormValues>({ ...emptyValues });
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (initialTask) {
      setValues({
        title: initialTask.title,
        description: initialTask.description,
        plannedStart: toInputValue(initialTask.planned_start),
        plannedEnd: toInputValue(initialTask.planned_end),
        duration: initialTask.duration,
        completionRule: initialTask.completion_rule as TaskFormValues["completionRule"],
        outcomeDescription: initialTask.outcome.description,
        outcomeAcceptanceCriteria: initialTask.outcome.acceptance_criteria,
        outcomeDeadline: toInputValue(initialTask.outcome.deadline),
        parentId: initialTask.parent_id ?? "",
      });
    } else {
      setValues({ ...emptyValues });
    }
  }, [initialTask]);

  useEffect(() => {
    setError(null);
  }, [values.plannedStart, values.plannedEnd]);

  const parents = useMemo(() => tasks.filter((task) => task.id !== initialTask?.id), [tasks, initialTask?.id]);

  const updateField = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const title = values.title.trim();
    if (!title) {
      setError("Введите название задачи");
      return;
    }

    const now = new Date();
    const fallbackStart = values.plannedStart || toInputValue(now.toISOString());
    const fallbackEnd =
      values.plannedEnd ||
      (() => {
        const end = new Date(now);
        end.setDate(end.getDate() + 1);
        return toInputValue(end.toISOString());
      })();
    const fallbackDeadline =
      values.outcomeDeadline ||
      (() => {
        const end = new Date(fallbackEnd);
        end.setDate(end.getDate() + 1);
        return toInputValue(end.toISOString());
      })();

    const startTs = new Date(fallbackStart).getTime();
    const endTs = new Date(fallbackEnd).getTime();
    if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs < startTs) {
      setError("Дата окончания раньше даты начала");
      return;
    }

    const sanitized: TaskFormValues = {
      ...values,
      title,
      description: values.description.trim(),
      plannedStart: fallbackStart,
      plannedEnd: fallbackEnd,
      duration: Number.isFinite(values.duration) ? values.duration : 0,
      outcomeDescription: values.outcomeDescription.trim(),
      outcomeAcceptanceCriteria: values.outcomeAcceptanceCriteria.trim(),
      outcomeDeadline: fallbackDeadline,
    };

    onSubmit(sanitized);
    if (mode === "create") {
      setValues({ ...emptyValues, plannedStart: values.plannedStart, plannedEnd: values.plannedEnd });
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="table-header">
        <div>
          <h3>Данные задачи</h3>
          <p className="muted">Название, сроки, связи и результат</p>
        </div>
        {loading && <span className="tag">Сохраняем...</span>}
      </div>

      <div className="form-field">
        <label htmlFor="task-title">Название</label>
        <input
          id="task-title"
          className="input"
          value={values.title}
          onChange={(event) => updateField("title", event.target.value)}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="task-description">Описание</label>
        <textarea
          id="task-description"
          className="input"
          rows={3}
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          required
        />
      </div>

      <button
        type="button"
        className="ghost-btn"
        style={{ width: "fit-content", marginBottom: "0.5rem" }}
        onClick={() => setShowAdvanced((prev) => !prev)}
        aria-expanded={showAdvanced}
      >
        {showAdvanced ? "Скрыть доп. поля" : "Дополнительные поля"}
      </button>

      {showAdvanced && (
        <>
          <div className="grid" style={{ gap: "1rem" }}>
            <div className="form-field">
              <label htmlFor="planned-start">Плановое начало</label>
              <input
                id="planned-start"
                type="datetime-local"
                className="input"
                value={values.plannedStart}
                onChange={(event) => updateField("plannedStart", event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="planned-end">Плановое завершение</label>
              <input
                id="planned-end"
                type="datetime-local"
                className="input"
                value={values.plannedEnd}
                onChange={(event) => updateField("plannedEnd", event.target.value)}
              />
            </div>
          </div>

          <div className="grid" style={{ gap: "1rem" }}>
            <div className="form-field">
              <label htmlFor="task-duration">Трудозатраты (часы)</label>
              <input
                id="task-duration"
                type="number"
                min={0}
                className="input"
                value={values.duration}
                onChange={(event) => updateField("duration", Number(event.target.value))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="task-rule">Правило завершения</label>
              <select
                id="task-rule"
                className="input"
                value={values.completionRule}
                onChange={(event) => updateField("completionRule", event.target.value as TaskFormValues["completionRule"])}
              >
                <option value="AllAssignees">Все исполнители</option>
                <option value="AnyOne">Любой исполнитель</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="parent-task">Родительская задача</label>
            <select
              id="parent-task"
              className="input"
              value={values.parentId}
              onChange={(event) => updateField("parentId", event.target.value)}
            >
              <option value="">Без родителя</option>
              {parents.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid" style={{ gap: "1rem" }}>
            <div className="form-field">
              <label htmlFor="outcome-description">Описание результата</label>
              <textarea
                id="outcome-description"
                className="input"
                rows={2}
                value={values.outcomeDescription}
                onChange={(event) => updateField("outcomeDescription", event.target.value)}
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
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="outcome-deadline">Дедлайн результата</label>
            <input
              id="outcome-deadline"
              type="datetime-local"
              className="input"
              value={values.outcomeDeadline}
              onChange={(event) => updateField("outcomeDeadline", event.target.value)}
            />
          </div>
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button className="primary-btn" type="submit" disabled={loading}>
          {mode === "edit" ? "Сохранить" : "Создать задачу"}
        </button>
      </div>
    </form>
  );
};

export default TaskForm;
