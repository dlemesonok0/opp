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
  assignTeam: boolean;
  assigneeIds: string[];
  dependencies: Array<{
    predecessorId: string;
    type: "FS" | "FF" | "SS" | "SF";
    lag: number;
  }>;
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
  externalError?: string | null;
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
  assignTeam: false,
  assigneeIds: [],
  dependencies: [],
};

const toInputValue = (value: string) => {
  // Преобразуем ISO (UTC) в локальный формат для input datetime-local, чтобы не было смещения по времени
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const tzOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
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
  externalError = null,
}: TaskFormProps) => {
  const [values, setValues] = useState<TaskFormValues>({ ...emptyValues });
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const displayedError = error ?? externalError;

  const availablePredecessors = tasks.filter((t) => !initialTask || t.id !== initialTask.id);

  useEffect(() => {
    const hasTeamOption = assignees.some((a) => a.type === "team");
    const memberIds = members.map((member) => member.id);

    if (initialTask) {
      const initialAssignees = initialTask.assignee_ids ?? [];
      const hasAllMembersAssigned =
        memberIds.length > 0 && memberIds.every((id) => initialAssignees.includes(id));

      setValues({
        title: initialTask.title,
        description: initialTask.description,
        plannedStart: toInputValue(initialTask.planned_start),
        plannedEnd: toInputValue(initialTask.planned_end),
        deadline: toInputValue(initialTask.deadline ?? ""),
        duration: initialTask.duration,
        completionRule: initialTask.completion_rule as TaskFormValues["completionRule"],
        outcomeDescription: initialTask.outcome.description,
        outcomeAcceptanceCriteria: initialTask.outcome.acceptance_criteria,
        assignTeam: hasTeamOption && hasAllMembersAssigned,
        assigneeIds: initialAssignees,
        dependencies:
          initialTask.dependencies?.map((dep) => ({
            predecessorId: dep.predecessor_task_id,
            type: dep.type,
            lag: dep.lag,
          })) ?? [],
      });
    } else {
      setValues({
        ...emptyValues,
        assignTeam: hasTeamOption && memberIds.length > 0,
      });
    }
  }, [initialTask, assignees, members]);

  useEffect(() => {
    setError(null);
  }, [values.plannedStart, values.plannedEnd, values.deadline]);

  const updateField = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const updateDependency = <K extends keyof TaskFormValues["dependencies"][number]>(
    index: number,
    key: K,
    value: TaskFormValues["dependencies"][number][K],
  ) => {
    setValues((prev) => {
      const next = [...prev.dependencies];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, dependencies: next };
    });
  };

  const addDependency = () => {
    const first = availablePredecessors[0]?.id;
    if (!first) return;
    setValues((prev) => ({
      ...prev,
      dependencies: [...prev.dependencies, { predecessorId: first, type: "FS", lag: 0 }],
    }));
  };

  const removeDependency = (index: number) => {
    setValues((prev) => ({
      ...prev,
      dependencies: prev.dependencies.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const title = values.title.trim();
    if (!title) {
      setError("Введите название задачи");
      return;
    }

    const plannedStartLocal = values.plannedStart || "";
    const plannedEndLocal = values.plannedEnd || "";
    const deadlineLocal = values.deadline || "";

    const plannedStartDate = plannedStartLocal ? new Date(plannedStartLocal) : null;
    const plannedEndDate = plannedEndLocal ? new Date(plannedEndLocal) : null;
    const deadlineDate = deadlineLocal ? new Date(deadlineLocal) : null;

    if (plannedStartDate && !Number.isFinite(plannedStartDate.getTime())) {
      setError("Invalid planned start date");
      return;
    }
    if (plannedEndDate && !Number.isFinite(plannedEndDate.getTime())) {
      setError("Invalid planned end date");
      return;
    }
    if (deadlineDate && !Number.isFinite(deadlineDate.getTime())) {
      setError("Invalid deadline date");
      return;
    }

    const plannedStartIso = plannedStartDate ? plannedStartDate.toISOString() : "";
    const plannedEndIso = plannedEndDate ? plannedEndDate.toISOString() : "";
    const deadlineIso = deadlineDate ? deadlineDate.toISOString() : "";

    const duration = Number.isFinite(values.duration) ? values.duration : 0;

    if (!deadlineLocal && !plannedStartLocal && duration <= 0) {
      setError("Задайте длительность или дату начала/дедлайн");
      return;
    }

    if (plannedStartLocal && plannedEndLocal) {
      const startTs = plannedStartDate!.getTime();
      const endTs = plannedEndDate!.getTime();
      if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs < startTs) {
        setError("Плановое окончание раньше старта");
        return;
      }
    }

    if (deadlineDate && plannedStartDate && deadlineDate.getTime() < plannedStartDate.getTime()) {
      setError("Дедлайн не может быть раньше планового старта");
      return;
    }

    const teamAssignee = assignees.find((a) => a.type === "team");
    const computedAssigneeIds: string[] = [];
    const pushAssignee = (id: string) => {
      if (id && !computedAssigneeIds.includes(id)) {
        computedAssigneeIds.push(id);
      }
    };
    if (values.assignTeam && teamAssignee) {
      pushAssignee(teamAssignee.id);
    }
    values.assigneeIds.filter(Boolean).forEach((id) => pushAssignee(id));

    const sanitized: TaskFormValues = {
      ...values,
      title,
      description: values.description.trim(),
      plannedStart: plannedStartIso,
      plannedEnd: plannedEndIso,
      deadline: deadlineIso,
      duration,
      outcomeDescription: values.outcomeDescription.trim(),
      outcomeAcceptanceCriteria: values.outcomeAcceptanceCriteria.trim(),
      assigneeIds: computedAssigneeIds,
      dependencies: values.dependencies
        .filter((dep) => dep.predecessorId)
        .map((dep) => ({
          predecessorId: dep.predecessorId,
          type: dep.type,
          lag: Number.isFinite(dep.lag) ? dep.lag : 0,
        })),
    };

    onSubmit(sanitized);
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
        />
      </div>

      <div className="form-field">
        <label htmlFor="deadline">Дедлайн</label>
        <input
          id="deadline"
          type="datetime-local"
          className="input"
          value={values.deadline}
          onChange={(event) => updateField("deadline", event.target.value)}
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
          <div className="form-field">
            <label htmlFor="planned-start">Плановый старт (необязательно)</label>
            <input
              id="planned-start"
              type="datetime-local"
              className="input"
              value={values.plannedStart}
              onChange={(event) => updateField("plannedStart", event.target.value)}
              placeholder="Укажите плановый старт при необходимости"
            />
          </div>

          <div className="grid" style={{ gap: "1rem" }}>
            <div className="form-field">
              <label htmlFor="task-duration">Длительность (дни)</label>
              <input
                id="task-duration"
                type="number"
                min={0}
                step="0.25"
                className="input"
                value={Number.isFinite(values.duration) ? values.duration : ""}
                onChange={(event) =>
                  updateField("duration", event.target.value === "" ? Number.NaN : Number(event.target.value))
                }
                placeholder="Введите длительность в днях (можно дробные значения)"
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
                <option value="AnyOne">Любой</option>
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Исполнители</label>
            <div className="stack" style={{ gap: "8px" }}>
              {assignees.some((a) => a.type === "team") && (
                <label className="muted">
                  <input
                    type="checkbox"
                    checked={values.assignTeam}
                    onChange={(event) => updateField("assignTeam", event.target.checked)}
                    style={{ marginRight: "8px" }}
                  />
                  Вся команда
                </label>
              )}
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

          <div className="form-field">
            <label>
              Зависимости{" "}
              <span
                className="muted"
                title="FS — начало после завершения; FF — завершение после завершения; SS — начало после начала; SF — завершение после начала."
                style={{ cursor: "help" }}
              >
                (?)
              </span>
            </label>
            <div className="stack" style={{ gap: "8px" }}>
              {values.dependencies.map((dep, index) => (
                <div
                  key={`${dep.predecessorId}-${index}`}
                  className="dependency-row"
                  style={{
                    display: "grid",
                    gap: "8px",
                    gridTemplateColumns: "minmax(0, 1fr) 120px 120px auto",
                    alignItems: "center",
                  }}
                >
                  <select
                    className="input"
                    value={dep.predecessorId}
                    onChange={(event) => updateDependency(index, "predecessorId", event.target.value)}
                    style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {availablePredecessors.map((task) => (
                      <option key={task.id} value={task.id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={dep.type}
                    onChange={(event) =>
                      updateDependency(
                        index,
                        "type",
                        event.target.value as TaskFormValues["dependencies"][number]["type"],
                      )
                    }
                  >
                    <option value="FS">FS</option>
                    <option value="FF">FF</option>
                    <option value="SS">SS</option>
                    <option value="SF">SF</option>
                  </select>
                  <input
                    type="number"
                    className="input"
                    value={dep.lag}
                    onChange={(event) => updateDependency(index, "lag", Number(event.target.value))}
                    title="Сдвиг в часах относительно выбранной зависимости"
                    placeholder="задержка"
                  />
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => removeDependency(index)}
                    aria-label="Удалить зависимость"
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="ghost-btn"
                onClick={addDependency}
                disabled={availablePredecessors.length === 0}
              >
                Добавить зависимость
              </button>
              {availablePredecessors.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>
                  Нет задач для связывания в зависимость.
                </p>
              )}
            </div>
          </div>
        </>
      )}
      {displayedError && <p className="form-error">{displayedError}</p>}

      <div className="form-actions">
        <button className="primary-btn" type="submit" disabled={loading}>
          {mode === "edit" ? "Сохранить" : "Создать задачу"}
        </button>
      </div>
    </form>
  );
};

export default TaskForm;
