import { useEffect, useState } from "react";
import type { Assignee, Task } from "../api/taskApi";
import type { TeamMember } from "../../teams/api/teamApi";

export type TaskFormValues = {
  title: string;
  description: string;
  plannedStart: string;
  plannedEnd: string;
  deadline: string;
  duration: number;
  completionRule: "AnyOne" | "AllAssignees";
  outcomeDescription: string;
  outcomeAcceptanceCriteria: string;
  assigneeMode: "team" | "custom";
  assigneeIds: string[];
};

type TaskFormProps = {
  tasks: Task[];
  loading?: boolean;
  initialTask?: Task | null;
  mode?: "create" | "edit";
  parentTask?: Task | null;
  members: TeamMember[];
  assignees: Assignee[];
  onSubmit: (values: TaskFormValues) => void;
};

const emptyValues: TaskFormValues = {
  title: "",
  description: "",
  plannedStart: "",
  plannedEnd: "",
  deadline: "",
  duration: 0,
  completionRule: "AllAssignees",
  outcomeDescription: "",
  outcomeAcceptanceCriteria: "",
  assigneeMode: "team",
  assigneeIds: [],
};

const toInputValue = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

const TaskForm = ({
  tasks,
  loading,
  onSubmit,
  initialTask = null,
  mode = "create",
  parentTask = null,
  members,
  assignees,
}: TaskFormProps) => {
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
        deadline: toInputValue(initialTask.deadline ?? initialTask.planned_end),
        duration: initialTask.duration,
        completionRule: initialTask.completion_rule as TaskFormValues["completionRule"],
        outcomeDescription: initialTask.outcome.description,
        outcomeAcceptanceCriteria: initialTask.outcome.acceptance_criteria,
        assigneeMode: "custom",
        assigneeIds: initialTask.assignee_ids ?? [],
      });
    } else {
      setValues({ ...emptyValues });
    }
  }, [initialTask]);

  useEffect(() => {
    setError(null);
  }, [values.plannedStart, values.plannedEnd, values.deadline]);

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

    const plannedStart = values.plannedStart || "";
    const plannedEnd = values.plannedEnd || "";
    const deadline = values.deadline || "";

    const duration = Number.isFinite(values.duration) ? values.duration : 0;

    if (!deadline && !plannedStart && duration <= 0) {
      setError("Укажите дедлайн, плановое начало или трудозатраты");
      return;
    }

    if (plannedStart && plannedEnd) {
      const startTs = new Date(plannedStart).getTime();
      const endTs = new Date(plannedEnd).getTime();
      if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs < startTs) {
        setError("Дата окончания раньше даты начала");
        return;
      }
    }

    const teamAssignee = assignees.find((a) => a.type === "team");
    const computedAssigneeIds =
      values.assigneeMode === "team" && teamAssignee
        ? [teamAssignee.id]
        : values.assigneeIds.filter(Boolean);

    const sanitized: TaskFormValues = {
      ...values,
      title,
      description: values.description.trim(),
      plannedStart,
      plannedEnd,
      deadline: deadline || plannedEnd,
      duration,
      outcomeDescription: values.outcomeDescription.trim(),
      outcomeAcceptanceCriteria: values.outcomeAcceptanceCriteria.trim(),
      assigneeIds: computedAssigneeIds,
    };

    onSubmit(sanitized);
    if (mode === "create") {
      setValues({ ...emptyValues });
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

      {parentTask && (
        <div className="info-block" style={{ background: "#eef2ff", borderColor: "#c7d2fe" }}>
          <strong>Подзадача для: {parentTask.title}</strong>
          <p className="muted" style={{ margin: 0 }}>
            Эта подзадача должна завершиться до задачи-родителя.
          </p>
        </div>
      )}

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
              <label htmlFor="deadline">Дедлайн задачи</label>
              <input
                id="deadline"
                type="datetime-local"
                className="input"
                value={values.deadline}
                onChange={(event) => updateField("deadline", event.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="planned-start">Плановое начало (опционально)</label>
            <input
              id="planned-start"
              type="datetime-local"
              className="input"
              value={values.plannedStart}
              onChange={(event) => updateField("plannedStart", event.target.value)}
              placeholder="Указать если нужно стартовать раньше"
            />
        </div>

        <div className="grid" style={{ gap: "1rem" }}>
          <div className="form-field">
            <label htmlFor="task-duration">Трудозатраты (часы, необязательно)</label>
              <input
                id="task-duration"
                type="number"
                min={0}
                className="input"
                value={Number.isFinite(values.duration) ? values.duration : ""}
                onChange={(event) =>
                  updateField("duration", event.target.value === "" ? Number.NaN : Number(event.target.value))
                }
                placeholder="Можно оставить пустым"
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
            <label>Ответственные</label>
            <div className="stack" style={{ gap: "8px" }}>
              <label className="muted">
                <input
                  type="radio"
                  name="assignees-mode"
                  value="team"
                  checked={values.assigneeMode === "team"}
                  onChange={() => updateField("assigneeMode", "team")}
                  style={{ marginRight: "8px" }}
                />
                Вся команда
              </label>
              <label className="muted">
                <input
                  type="radio"
                  name="assignees-mode"
                  value="custom"
                  checked={values.assigneeMode === "custom"}
                  onChange={() => updateField("assigneeMode", "custom")}
                  style={{ marginRight: "8px" }}
                />
                Выбрать участников
              </label>
              {values.assigneeMode === "custom" && (
                <div className="stack" style={{ gap: "4px" }}>
                  {assignees
                    .filter((a) => a.type === "user")
                .map((assignee) => {
                  const checked = values.assigneeIds.includes(assignee.id);
                  return (
                    <label key={assignee.id} className="muted">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const newIds = checked
                            ? values.assigneeIds.filter((id) => id !== assignee.id)
                            : [...values.assigneeIds, assignee.id];
                          updateField("assigneeIds", newIds);
                        }}
                        style={{ marginRight: "8px" }}
                      />
                      {assignee.name}
                      {assignee.email ? ` (${assignee.email})` : ""}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
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
