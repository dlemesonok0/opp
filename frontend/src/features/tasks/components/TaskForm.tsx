import { useEffect, useMemo, useState } from "react";
import type { Task } from "../api/taskApi";

export type TaskFormValues = {
  title: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  duration: number;
  isMilestone: boolean;
  completionRule: "AnyOne" | "AllAssignees";
  outcomeDescription: string;
  outcomeAcceptanceCriteria: string;
  outcomeDeadline: string;
  parentId: string;
};

type TaskFormProps = {
  tasks: Task[];
  loading?: boolean;
  onSubmit: (values: TaskFormValues) => void;
};

const emptyValues: TaskFormValues = {
  title: "",
  description: "",
  plannedStart: "",
  plannedEnd: "",
  duration: 1,
  isMilestone: false,
  completionRule: "AllAssignees",
  outcomeDescription: "",
  outcomeAcceptanceCriteria: "",
  outcomeDeadline: "",
  parentId: "",
};

const TaskForm = ({ tasks, loading, onSubmit }: TaskFormProps) => {
  const [values, setValues] = useState<TaskFormValues>({ ...emptyValues });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [values.plannedStart, values.plannedEnd]);

  const parents = useMemo(() => tasks.filter((task) => !task.is_milestone), [tasks]);

  const updateField = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (values.plannedStart && values.plannedEnd) {
      const start = new Date(values.plannedStart).getTime();
      const end = new Date(values.plannedEnd).getTime();
      if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
        setError("Дата окончания должна быть позже даты начала");
        return;
      }
    }

    onSubmit(values);
    setValues({ ...emptyValues, plannedStart: values.plannedStart, plannedEnd: values.plannedEnd });
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="table-header">
        <div>
          <h3>Добавить задачу</h3>
          <p className="muted">Название, сроки, критерии приёмки</p>
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

      <div className="grid" style={{ gap: "1rem" }}>
        <div className="form-field">
          <label htmlFor="planned-start">Плановая дата начала</label>
          <input
            id="planned-start"
            type="datetime-local"
            className="input"
            value={values.plannedStart}
            onChange={(event) => updateField("plannedStart", event.target.value)}
            required
          />
        </div>
        <div className="form-field">
          <label htmlFor="planned-end">Плановая дата завершения</label>
          <input
            id="planned-end"
            type="datetime-local"
            className="input"
            value={values.plannedEnd}
            onChange={(event) => updateField("plannedEnd", event.target.value)}
            required
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
            required
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
        <div className="form-field">
          <label htmlFor="task-milestone">Веха</label>
          <input
            id="task-milestone"
            type="checkbox"
            checked={values.isMilestone}
            onChange={(event) => updateField("isMilestone", event.target.checked)}
          />
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
          <label htmlFor="outcome-description">Результат</label>
          <textarea
            id="outcome-description"
            className="input"
            rows={2}
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
      </div>

      <div className="form-field">
        <label htmlFor="outcome-deadline">Дедлайн результата</label>
        <input
          id="outcome-deadline"
          type="datetime-local"
          className="input"
          value={values.outcomeDeadline}
          onChange={(event) => updateField("outcomeDeadline", event.target.value)}
          required
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button className="primary-btn" type="submit" disabled={loading}>
          Создать задачу
        </button>
      </div>
    </form>
  );
};

export default TaskForm;
