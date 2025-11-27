import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import {
  getProject,
  updateProject,
  type Project,
  type ProjectUpdatePayload,
} from "../api/projectApi";
import { createTask, deleteTask, listProjectTasks, updateTask, type Task } from "../../tasks/api/taskApi";
import ProjectForm, { type ProjectFormValues } from "../components/ProjectForm";
import TaskForm, { type TaskFormValues } from "../../tasks/components/TaskForm";
import {
  createTeamInvite,
  listTeamInvites,
  revokeInvite,
  type TeamInvite,
} from "../../teams/api/inviteApi";
import {
  deleteTeamMember,
  listTeamMembers,
  type TeamMember,
} from "../../teams/api/teamApi";

type TimelineBounds = {
  min: number;
  max: number;
};

const toTs = (value: string) => new Date(value).getTime();
const statusClass = (status: string) => {
  switch (status) {
    case "Done":
      return "gantt-bar--done";
    case "InProgress":
      return "gantt-bar--progress";
    case "Blocked":
      return "gantt-bar--blocked";
    case "Cancelled":
      return "gantt-bar--cancelled";
    default:
      return "gantt-bar--planned";
  }
};

const buildTimeline = (tasks: Task[]): TimelineBounds | null => {
  if (tasks.length === 0) return null;

  let min = Number.MAX_SAFE_INTEGER;
  let max = 0;

  tasks.forEach((task) => {
    const start = toTs(task.planned_start);
    const end = toTs(task.deadline ?? task.planned_end);
    min = Math.min(min, start);
    max = Math.max(max, end);
  });

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === Number.MAX_SAFE_INTEGER) {
    return null;
  }

  return { min, max: Math.max(max, min + 1) };
};

const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const { accessToken, user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [invitesError, setInvitesError] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      if (!projectId || !accessToken) return;
      setLoadingProject(true);
      setError(null);
      try {
        const data = await getProject(accessToken, projectId);
        setProject(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingProject(false);
      }
    };

    void loadProject();
  }, [accessToken, projectId]);

  useEffect(() => {
    const loadTasks = async () => {
      if (!projectId || !accessToken) return;
      setLoadingTasks(true);
      setError(null);
      try {
        const items = await listProjectTasks(accessToken, projectId);
        setTasks(items);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingTasks(false);
      }
    };

    void loadTasks();
  }, [accessToken, projectId]);

  useEffect(() => {
    const loadInvites = async () => {
      if (!accessToken || !project?.team_id) return;
      setLoadingInvites(true);
      setInvitesError(null);
      try {
        const items = await listTeamInvites(accessToken, project.team_id);
        setInvites(items);
      } catch (err) {
        setInvitesError((err as Error).message);
      } finally {
        setLoadingInvites(false);
      }
    };
    void loadInvites();
  }, [accessToken, project?.team_id]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!accessToken || !project?.team_id) return;
      setLoadingMembers(true);
      setMembersError(null);
      try {
        const data = await listTeamMembers(accessToken, project.team_id);
        setMembers(data);
      } catch (err) {
        setMembersError((err as Error).message);
      } finally {
        setLoadingMembers(false);
      }
    };
    void loadMembers();
  }, [accessToken, project?.team_id]);

  const handleSubmitTask = async (values: TaskFormValues) => {
    if (!accessToken || !projectId) return;

    const projectDeadline = project?.outcome.deadline
      ? new Date(project.outcome.deadline).toISOString()
      : new Date().toISOString();

    const durationHours = Math.max(0, values.duration);

    const pickEnd = () => {
      if (values.deadline) return new Date(values.deadline).toISOString();
      if (values.plannedEnd) return new Date(values.plannedEnd).toISOString();
      // если подзадача без конкретного дедлайна — привязываем к старту родителя или дедлайну проекта
      if (parentTask?.planned_start || parentTask?.deadline) {
        return new Date(parentTask.planned_start ?? parentTask.deadline ?? projectDeadline).toISOString();
      }
      // если только длительность — планируем от дедлайна проекта
      return new Date(projectDeadline).toISOString();
    };

    const endIso = pickEnd();
    const startIso = (() => {
      if (values.plannedStart) return new Date(values.plannedStart).toISOString();
      const end = new Date(endIso);
      const effectiveDurationHours = durationHours > 0 ? durationHours : 1;
      const start = new Date(end.getTime() - effectiveDurationHours * 3600 * 1000);
      return start.toISOString();
    })();

    const finalEnd = values.deadline ? values.deadline : endIso;

    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || "No description yet",
      duration: durationHours,
      plannedStart: startIso,
      plannedEnd: new Date(endIso).toISOString(),
      deadline: new Date(finalEnd).toISOString(),
      autoScheduled: Boolean(values.deadline && !values.plannedStart),
      completionRule: values.completionRule,
      parentId: parentTask ? parentTask.id : null,
      outcome: {
        description: values.outcomeDescription.trim() || "Outcome not described",
        acceptanceCriteria: values.outcomeAcceptanceCriteria.trim() || "Acceptance criteria not set",
        deadline: new Date(finalEnd).toISOString(),
      },
    };

    setSavingTask(true);
    setError(null);
    try {
      if (editingTask) {
        await updateTask(accessToken, editingTask.id, payload);
      } else {
        await createTask(accessToken, projectId, payload);
      }
      const updated = await listProjectTasks(accessToken, projectId);
      setTasks(updated);
      setShowTaskModal(false);
      setEditingTask(null);
      setParentTask(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTask(false);
    }
  };

  const handleUpdateProject = async (values: ProjectFormValues) => {
    if (!accessToken || !project) return;
    setSavingProject(true);
    setError(null);
    try {
      const baseOutcomeDescription = values.outcomeDescription.trim() || "Результат пока не описан";
      const baseOutcomeCriteria = values.outcomeAcceptanceCriteria.trim() || "Критерии пока не заданы";
      const baseDescription = values.description.trim() || "Описание проекта пока не заполнено";
      const payload: ProjectUpdatePayload = {
        title: values.title,
        description: baseDescription,
        outcome: {
          description: baseOutcomeDescription,
          acceptanceCriteria: baseOutcomeCriteria,
          deadline: new Date(values.outcomeDeadline).toISOString(),
        },
      };
      const updated = await updateProject(accessToken, project.id, payload);
      setProject(updated);
      setShowEditModal(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingProject(false);
    }
  };

  const handleCreateInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !project?.team_id) return;
    const email = inviteEmail.trim();
    if (!email) {
      setInviteStatus("Введите email");
      return;
    }
    setInviteStatus(null);
    setInvitesError(null);
    setLoadingInvites(true);
    try {
      await createTeamInvite(accessToken, project.team_id, email);
      setInviteEmail("");
      setInviteStatus("Приглашение отправлено");
      const refreshed = await listTeamInvites(accessToken, project.team_id);
      setInvites(refreshed);
      setShowInviteModal(false);
    } catch (err) {
      setInvitesError((err as Error).message);
    } finally {
      setLoadingInvites(false);
    }
  };

  const timeline = useMemo(() => buildTimeline(tasks), [tasks]);
  const axisTicks = useMemo(() => {
    if (!timeline) return [];
    const total = timeline.max - timeline.min;
    if (total <= 0) return [];

    const steps = 6;
    const ticks = [];
    for (let i = 0; i <= steps; i++) {
      const value = timeline.min + (total * i) / steps;
      const left = (i / steps) * 100;
      const date = new Date(value);
      const label = `${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      ticks.push({ left, label });
    }
    return ticks;
  }, [timeline]);
  const renderGanttBar = (task: Task) => {
    if (!timeline) return null;

    const total = timeline.max - timeline.min;
    const start = toTs(task.planned_start);
    const end = toTs(task.deadline ?? task.planned_end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || total <= 0) return null;

    const offset = Math.max(0, ((start - timeline.min) / total) * 100);
    const width = Math.max(3, ((end - start) / total) * 100);
    const label = `${new Date(task.planned_start).toLocaleDateString("ru-RU")} - ${new Date(
      task.deadline ?? task.planned_end,
    ).toLocaleDateString("ru-RU")}`;
    const statusCls = statusClass(task.status);

    return (
      <div key={task.id} className="gantt-row">
        <div className="gantt-row__label">
          <span className="gantt-row__title">{task.title}</span>
          <span className="gantt-row__meta">
            {task.completion_rule} · <span className={`tag ${statusCls.replace("gantt-bar", "tag")}`}>{task.status}</span>
          </span>
        </div>
        <div className="gantt-row__track">
          <div className={`gantt-bar ${statusCls}`} style={{ left: `${offset}%`, width: `${width}%` }}>
            <span className="gantt-bar__label">{task.title}</span>
          </div>
        </div>
      </div>
    );
  };
  const isMember = Boolean(user && members.some((member) => member.id === user.id));

  const shiftDate = (value: string | null, deltaHours: number) => {
    if (!value) return null;
    const d = new Date(value);
    if (!Number.isFinite(d.getTime())) return null;
    d.setHours(d.getHours() + deltaHours);
    return d.toISOString();
  };

  const handleShiftTask = async (task: Task, deltaHours: number) => {
    if (!accessToken) return;
    setSavingTask(true);
    setError(null);
    try {
      const payload = {
        plannedStart: shiftDate(task.planned_start, deltaHours) ?? task.planned_start,
        plannedEnd: shiftDate(task.planned_end, deltaHours) ?? task.planned_end,
        deadline: shiftDate(task.deadline, deltaHours) ?? task.deadline ?? task.planned_end,
      };
      await updateTask(accessToken, task.id, payload);
      const updated = await listProjectTasks(accessToken, projectId ?? "");
      setTasks(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTask(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!accessToken || !project?.team_id || !user) return;
    setLeaving(true);
    setMembersError(null);
    try {
      await deleteTeamMember(accessToken, project.team_id, user.id);
      navigate("/");
    } catch (err) {
      setMembersError((err as Error).message);
      setLeaving(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!accessToken || !projectId) return;
    setSavingTask(true);
    setError(null);
    try {
      await deleteTask(accessToken, taskId);
      if (editingTask?.id === taskId) {
        closeTaskModal();
      }
      const updated = await listProjectTasks(accessToken, projectId);
      setTasks(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTask(false);
    }
  };

  const openTaskModal = (task?: Task | null, parent?: Task | null) => {
    setEditingTask(task ?? null);
    setParentTask(parent ?? null);
    setShowTaskModal(true);
  };

  const closeTaskModal = () => {
    setShowTaskModal(false);
    setEditingTask(null);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!accessToken || !project?.team_id) return;
    setLoadingInvites(true);
    setInvitesError(null);
    try {
      await revokeInvite(accessToken, inviteId);
      const refreshed = await listTeamInvites(accessToken, project.team_id);
      setInvites(refreshed);
    } catch (err) {
      setInvitesError((err as Error).message);
    } finally {
      setLoadingInvites(false);
    }
  };

  const childrenMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (t.parent_id) {
        const bucket = map.get(t.parent_id) ?? [];
        bucket.push(t);
        map.set(t.parent_id, bucket);
      }
    });
    return map;
  }, [tasks]);

  const renderTaskItem = (task: Task, depth = 0) => (
    <article
      key={task.id}
      className="project-card"
      style={{ borderColor: depth ? "#e5e7eb" : undefined, marginLeft: depth ? depth * 14 : 0 }}
    >
      <header className="table-header">
        <div className="stack" style={{ gap: "6px" }}>
          <div className="stack" style={{ gap: "4px" }}>
            <h4 style={{ margin: 0 }}>{task.title}</h4>
            <p className="muted" style={{ margin: 0 }}>
              {task.description}
            </p>
          </div>
          {depth > 0 && <span className="tag subtask-tag">Подзадача</span>}
        </div>
        <div className="table-actions">
          <span className="tag">{task.status}</span>
          <button className="ghost-btn" type="button" onClick={() => openTaskModal(task)}>
            Редактировать
          </button>
          <button className="ghost-btn" type="button" onClick={() => openTaskModal(null, task)}>
            Подзадача
          </button>
          <button className="danger-btn" type="button" onClick={() => handleDeleteTask(task.id)} disabled={savingTask}>
            Удалить
          </button>
        </div>
      </header>
      <div className="project-meta">
        <span>
          {new Date(task.planned_start).toLocaleDateString("ru-RU")} —{" "}
          {new Date(task.deadline ?? task.planned_end).toLocaleDateString("ru-RU")}
        </span>
        <span>Правило завершения: {task.completion_rule}</span>
      </div>
      {childrenMap.get(task.id)?.length ? (
        <div className="stack" style={{ gap: "8px" }}>
          {childrenMap.get(task.id)!.map((child) => renderTaskItem(child, depth + 1))}
        </div>
      ) : null}
    </article>
  );

  return (
    <div className="stack">
      <div className="table-header">
        <div>
          <h2>Проект</h2>
          <p className="muted">План, команда и задачи</p>
        </div>
        <Link className="ghost-btn" to="/">
          На дашборд
        </Link>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showEditModal && project && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ minWidth: "640px" }}>
            <div className="table-header">
              <div>
                <h3>Редактировать проект</h3>
                <p className="muted">Название, описание и дедлайн результата</p>
              </div>
              <button className="ghost-btn" onClick={() => setShowEditModal(false)} aria-label="Закрыть">
                ✕
              </button>
            </div>
            <ProjectForm
              mode="edit"
              initialProject={project}
              onSubmit={handleUpdateProject}
              onCancel={() => setShowEditModal(false)}
              loading={savingProject}
            />
          </div>
        </div>
      )}

      {showTaskModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ minWidth: "640px" }}>
            <div className="table-header">
              <div>
                <h3>{editingTask ? "Редактировать задачу" : "Новая задача"}</h3>
                <p className="muted">Задайте детали задачи</p>
              </div>
              <button className="ghost-btn" onClick={closeTaskModal} aria-label="Закрыть">
                ×
              </button>
            </div>
            <TaskForm
              tasks={tasks}
              loading={savingTask}
              onSubmit={handleSubmitTask}
              initialTask={editingTask}
              mode={editingTask ? "edit" : "create"}
            />
          </div>
        </div>
      )}

      {showInviteModal && project?.team_id && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ minWidth: "480px" }}>
            <div className="table-header">
              <div>
                <h3>Пригласить в команду</h3>
                <p className="muted">Email адрес для приглашения</p>
              </div>
              <button className="ghost-btn" onClick={() => setShowInviteModal(false)} aria-label="Закрыть">
                ✕
              </button>
            </div>
            <form className="form" onSubmit={handleCreateInvite}>
              <div className="form-field">
                <label htmlFor="invite-email">Email</label>
                <input
                  id="invite-email"
                  type="email"
                  className="input"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div className="form-actions">
                <button className="ghost-btn" type="button" onClick={() => setShowInviteModal(false)}>
                  Отмена
                </button>
                <button className="primary-btn" type="submit" disabled={loadingInvites}>
                  {loadingInvites ? "Отправляем..." : "Отправить"}
                </button>
              </div>
              {inviteStatus && <p className="muted">{inviteStatus}</p>}
              {invitesError && <p className="form-error">{invitesError}</p>}
            </form>
          </div>
        </div>
      )}

      <section className="card">
        {loadingProject ? (
          <p>Загружаем проект...</p>
        ) : !project ? (
          <p>Проект не найден.</p>
        ) : (
          <div className="stack">
            <div className="table-header">
              <div>
                <h3>{project.title}</h3>
                <p className="muted">{project.description}</p>
              </div>
              <div className="stack" style={{ alignItems: "flex-end", gap: "0.5rem" }}>
                <span className="muted">
                  Дедлайн: {new Date(project.outcome.deadline).toLocaleDateString("ru-RU")}
                </span>
                <button className="ghost-btn" onClick={() => setShowEditModal(true)}>
                  {savingProject ? "Сохраняем..." : "Редактировать"}
                </button>
              </div>
            </div>
            <div className="info-block">
              <p className="muted">Критерии приемки</p>
              <p>{project.outcome.acceptance_criteria}</p>
            </div>
          </div>
        )}
      </section>

      {project?.team_id && (
        <section className="card">
          <div className="table-header">
            <div>
              <h3>Команда</h3>
              <p className="muted">Участники проекта</p>
            </div>
            {isMember && (
              <button className="danger-btn" onClick={handleLeaveTeam} disabled={leaving}>
                {leaving ? "Выходим..." : "Выйти из команды"}
              </button>
            )}
          </div>
          {membersError && <p className="form-error">{membersError}</p>}
          {loadingMembers ? (
            <p>Загружаем участников...</p>
          ) : members.length === 0 ? (
            <p className="muted">Пока нет участников.</p>
          ) : (
            <div className="stack">
              {members.map((member) => (
                <div key={member.id} className="project-card">
                  <div className="table-header">
                    <div>
                      <strong>{member.full_name || member.email}</strong>
                      <p className="muted">{member.email}</p>
                    </div>
                    {isMember && user?.id === member.id && <span className="tag">Вы</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {project?.team_id && (
        <section className="card">
          <div className="table-header">
            <div>
              <h3>Приглашения в команду</h3>
              <p className="muted">Отправьте приглашение по email</p>
            </div>
            <div className="stack" style={{ alignItems: "flex-end" }}>
              {loadingInvites && <span className="tag">Обновляем...</span>}
              <button className="primary-btn" type="button" onClick={() => setShowInviteModal(true)}>
                Пригласить
              </button>
            </div>
          </div>
          {invitesError && <p className="form-error">{invitesError}</p>}
          {invites.length > 0 && (
            <div className="stack" style={{ marginTop: "1rem" }}>
              {invites.map((invite) => (
                <div key={invite.id} className="project-card">
                  <div className="table-header">
                    <div>
                      <strong>{invite.invited_email}</strong>
                      <p className="muted">{new Date(invite.created_at).toLocaleString("ru-RU")}</p>
                    </div>
                    <div className="stack" style={{ alignItems: "flex-end" }}>
                      <span className="tag">{invite.status}</span>
                      {invite.status === "Pending" && (
                        <button
                          className="ghost-btn"
                          type="button"
                          onClick={() => handleRevokeInvite(invite.id)}
                        >
                          Отозвать
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="table-header">
          <div>
            <h3>Задачи</h3>
            <p className="muted">Список и статусы</p>
          </div>
          <div className="stack" style={{ alignItems: "flex-end" }}>
            {loadingTasks && <span className="tag">Загружаем...</span>}
            <button className="primary-btn" type="button" onClick={() => openTaskModal(null)}>
              Добавить задачу
            </button>
          </div>
        </div>
        {loadingTasks ? (
          <p>Загружаем задачи...</p>
        ) : tasks.length === 0 ? (
          <p className="muted">Задач пока нет.</p>
        ) : (
          <div className="stack" style={{ gap: "12px" }}>
            {tasks
              .filter((task) => !task.parent_id)
              .map((task) => renderTaskItem(task))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="table-header">
          <div>
            <h3>Хронология задач</h3>
            <p className="muted">Как задачи размещаются во времени</p>
          </div>
        </div>
        {!timeline || tasks.length === 0 ? (
          <p className="muted">Пока нечего показать: добавьте задачи.</p>
        ) : (
          <div className="stack" style={{ gap: "12px" }}>
            <div className="gantt-legend">
              <span className="legend-item"><span className="legend-dot legend-dot--planned" />План</span>
              <span className="legend-item"><span className="legend-dot legend-dot--progress" />В работе</span>
              <span className="legend-item"><span className="legend-dot legend-dot--done" />Готово</span>
              <span className="legend-item"><span className="legend-dot legend-dot--blocked" />Блок</span>
            </div>
            <div className="gantt-wrapper">
              <div className="gantt-scroll">
                <div className="gantt-chart">
                  <div className="gantt-axis">
                    {axisTicks.map((tick) => (
                      <div key={tick.left} className="gantt-axis__tick" style={{ left: `${tick.left}%` }}>
                        <span className="gantt-axis__line" />
                        <span className="gantt-axis__label">{tick.label}</span>
                      </div>
                    ))}
                  </div>
                  {tasks.map((task) => renderGanttBar(task))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectDetailPage;
