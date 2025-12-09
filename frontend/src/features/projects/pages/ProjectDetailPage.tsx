import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import {
  addProjectReviewer,
  getProject,
  updateProject,
  type Project,
  type ProjectUpdatePayload,
} from "../api/projectApi";
import {
  addTaskReviewer,
  createTask,
  deleteTask,
  listProjectTasks,
  updateTask,
  completeTask,
  recalcProjectTasks,
  type Task,
} from "../../tasks/api/taskApi";
import { type ProjectFormValues } from "../components/ProjectForm";
import { type TaskFormValues } from "../../tasks/components/TaskForm";
import { createTeamInvite, listTeamInvites, revokeInvite, type TeamInvite } from "../../teams/api/inviteApi";
import { deleteTeamMember, listTeamMembers, type TeamMember } from "../../teams/api/teamApi";
import ProjectPageHeader from "../components/ProjectPageHeader";
import EditProjectModal from "../components/EditProjectModal";
import ProjectReviewerModal from "../components/ProjectReviewerModal";
import TaskReviewerModal from "../components/TaskReviewerModal";
import InviteModal from "../components/InviteModal";
import TaskModal from "../components/TaskModal";
import ProjectSummarySection from "../components/ProjectSummarySection";
import TeamSection from "../components/TeamSection";
import ProjectReviewRequestSection from "../components/ProjectReviewRequestSection";
import InvitesSection from "../components/InvitesSection";
import TasksSection from "../components/TasksSection";
import TimelineSection, { type AxisTick, type TimelineBounds } from "../components/TimelineSection";

const buildTimeline = (tasks: Task[]): TimelineBounds | null => {
  if (tasks.length === 0) return null;

  let min = Number.MAX_SAFE_INTEGER;
  let max = 0;

  tasks.forEach((task) => {
    const start = new Date(task.planned_start).getTime();
    const end = new Date(task.deadline ?? task.planned_end).getTime();
    min = Math.min(min, start);
    max = Math.max(max, end);
  });

  if (!Number.isFinite(min) || !Number.isFinite(max) || min === Number.MAX_SAFE_INTEGER) {
    return null;
  }

  return { min, max: Math.max(max, min + 1) };
};

const buildAxisTicks = (timeline: TimelineBounds | null): AxisTick[] => {
  if (!timeline) return [];
  const total = timeline.max - timeline.min;
  if (total <= 0) return [];

  const steps = 6;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = timeline.min + (total * i) / steps;
    const left = (i / steps) * 100;
    const date = new Date(value);
    const label = `${date.toLocaleDateString("ru-RU")} ${date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    return { left, label };
  });
};

const buildChildrenMap = (tasks: Task[]) => {
  const map = new Map<string, Task[]>();
  tasks.forEach((t) => {
    if (t.parent_id) {
      const bucket = map.get(t.parent_id) ?? [];
      bucket.push(t);
      map.set(t.parent_id, bucket);
    }
  });
  return map;
};

const shiftDate = (value: string | null, deltaHours: number) => {
  if (!value) return null;
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return null;
  d.setHours(d.getHours() + deltaHours);
  return d.toISOString();
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
  const [showProjectReviewerModal, setShowProjectReviewerModal] = useState(false);
  const [projectReviewerEmail, setProjectReviewerEmail] = useState("");
  const [projectReviewerComment, setProjectReviewerComment] = useState("");
  const [showTaskReviewerModal, setShowTaskReviewerModal] = useState(false);
  const [taskReviewerEmail, setTaskReviewerEmail] = useState("");
  const [taskReviewerComment, setTaskReviewerComment] = useState("");
  const [taskForReview, setTaskForReview] = useState<Task | null>(null);
  const [reviewerMessage, setReviewerMessage] = useState<string | null>(null);
  const [reviewerError, setReviewerError] = useState<string | null>(null);
  const [savingReviewer, setSavingReviewer] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const teamAssigneeOption = project?.team_id
    ? [{ id: project.team_id, type: "team" as const, name: "Вся команда" }]
    : [];
  const assigneeOptions = teamAssigneeOption.concat(
    members.map((m) => ({
      id: m.id,
      type: "user" as const,
      name: m.full_name || m.email,
      email: m.email,
    })),
  );

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

  const handleRecalculateTasks = async () => {
    if (!projectId || !accessToken) return;
    setRecalculating(true);
    setError(null);
    try {
      const items = await recalcProjectTasks(accessToken, projectId);
      setTasks(items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRecalculating(false);
    }
  };

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

    const durationDays = Math.max(0, values.duration);
    const minDurationDays = durationDays > 0 ? durationDays : 1 / 60 / 24;
    const durationMs = minDurationDays * 24 * 3600 * 1000;

    const startProvided = Boolean(values.plannedStart);
    const plannedEndProvided = Boolean(values.plannedEnd);
    const durationOnly = !startProvided && !plannedEndProvided && !values.deadline;
    const hasDependencies = (values.dependencies?.length ?? 0) > 0;
    const projectDeadlineTs = project?.outcome.deadline ? new Date(project.outcome.deadline).getTime() : NaN;
    const parentStartTs = parentTask ? new Date(parentTask.planned_start).getTime() : null;
    const parentEndTs = parentTask ? new Date(parentTask.deadline ?? parentTask.planned_end).getTime() : null;
    const taskById = new Map<string, Task>(tasks.map((t) => [t.id, t]));
    let latestPredEndTs = Number.NEGATIVE_INFINITY;
    let depStartConstraint = Number.NEGATIVE_INFINITY;
    let depEndConstraint = Number.NEGATIVE_INFINITY;
    const toMs = (lag: number | undefined) => (Number.isFinite(lag) ? (lag as number) * 3600 * 1000 : 0);
    values.dependencies?.forEach((dep) => {
      const pred = taskById.get(dep.predecessorId);
      if (!pred) return;
      const predStart = new Date(pred.planned_start).getTime();
      const predEnd = new Date(pred.deadline ?? pred.planned_end).getTime();
      const lagMs = toMs(dep.lag);
      if (Number.isFinite(predEnd)) {
        latestPredEndTs = Math.max(latestPredEndTs, predEnd);
      }
      switch (dep.type) {
        case "FS":
          if (Number.isFinite(predEnd)) depStartConstraint = Math.max(depStartConstraint, predEnd + lagMs);
          break;
        case "SS":
          if (Number.isFinite(predStart)) depStartConstraint = Math.max(depStartConstraint, predStart + lagMs);
          break;
        case "FF":
          if (Number.isFinite(predEnd)) depEndConstraint = Math.max(depEndConstraint, predEnd + lagMs);
          break;
        case "SF":
          if (Number.isFinite(predStart)) depEndConstraint = Math.max(depEndConstraint, predStart + lagMs);
          break;
        default:
          break;
      }
    });
    const hasDepsEnd = Number.isFinite(latestPredEndTs) && latestPredEndTs > 0;

    // Базовые значения от пользователя или родителя.
    let startTs = values.plannedStart ? new Date(values.plannedStart).getTime() : NaN;
    let endTs = values.deadline ? new Date(values.deadline).getTime() : NaN;
    const plannedEndTs = values.plannedEnd ? new Date(values.plannedEnd).getTime() : NaN;

    // Если указан старт и длительность, но нет явного plannedEnd — ставим конец = старт + длительность.
    if (startProvided && !plannedEndProvided && Number.isFinite(startTs)) {
      endTs = startTs + durationMs;
    }

    if (parentTask) {
      // Подзадача: стараемся втиснуть ближе к концу родителя.
      if (!Number.isFinite(startTs)) {
        if (Number.isFinite(endTs)) {
          startTs = (endTs as number) - durationMs;
        } else if (Number.isFinite(parentEndTs)) {
          startTs = (parentEndTs as number) - durationMs;
        } else if (Number.isFinite(parentStartTs)) {
          startTs = parentStartTs as number;
        } else if (Number.isFinite(projectDeadlineTs)) {
          startTs = projectDeadlineTs - durationMs;
        } else {
          startTs = new Date().getTime();
        }
      }

      if (!Number.isFinite(endTs)) {
        if (Number.isFinite(plannedEndTs)) {
          endTs = plannedEndTs;
        } else {
          endTs = startTs + durationMs;
        }
      }

      if (Number.isFinite(depStartConstraint) && startTs < depStartConstraint) {
        startTs = depStartConstraint;
        endTs = Math.max(endTs, startTs + durationMs);
      }

      if (Number.isFinite(depEndConstraint) && endTs < depEndConstraint) {
        endTs = depEndConstraint;
        startTs = endTs - durationMs;
      }

      if (endTs < startTs + durationMs) {
        endTs = startTs + durationMs;
      }

      if (Number.isFinite(parentStartTs) && startTs < (parentStartTs as number)) {
        startTs = parentStartTs as number;
        endTs = Math.max(endTs, startTs + durationMs);
      }

      if (Number.isFinite(parentEndTs) && endTs > (parentEndTs as number)) {
        endTs = parentEndTs as number;
        startTs = endTs - durationMs;
        if (Number.isFinite(parentStartTs) && startTs < (parentStartTs as number)) {
          startTs = parentStartTs as number;
          endTs = startTs + durationMs;
        }
      }
    } else {
      // Обычная задача: если нет дат, считаем от дедлайна проекта или зависимостей.
      const depAnchor = hasDependencies && hasDepsEnd ? (latestPredEndTs as number) : NaN;
      const depEndAnchor = Number.isFinite(depEndConstraint) ? depEndConstraint : depAnchor;
      const deadlineAnchor = hasDependencies && Number.isFinite(projectDeadlineTs) ? projectDeadlineTs : depAnchor;
      const endAnchor = Number.isFinite(plannedEndTs)
        ? plannedEndTs
        : Number.isFinite(endTs)
          ? endTs
          : Number.isFinite(depEndAnchor)
            ? depEndAnchor
          : Number.isFinite(projectDeadlineTs) && (hasDependencies || durationOnly)
            ? projectDeadlineTs
            : NaN;

      if (!Number.isFinite(endTs)) {
        endTs = Number.isFinite(endAnchor) ? endAnchor : startTs + durationMs;
      }

      if (!Number.isFinite(startTs)) {
        if (Number.isFinite(endTs)) {
          startTs = (endTs as number) - durationMs;
        } else if (Number.isFinite(deadlineAnchor)) {
          startTs = deadlineAnchor - durationMs;
        } else {
          startTs = new Date().getTime();
        }
      }

      if (Number.isFinite(depStartConstraint) && startTs < depStartConstraint) {
        startTs = depStartConstraint;
        endTs = Math.max(endTs, startTs + durationMs);
      }

      if (Number.isFinite(depEndConstraint) && endTs < depEndConstraint) {
        endTs = depEndConstraint;
        startTs = endTs - durationMs;
      }

      if (!Number.isFinite(endTs)) {
        endTs = startTs + durationMs;
      }

      if (endTs < startTs + durationMs) {
        endTs = startTs + durationMs;
      }

      // Если есть дедлайн проекта, не выходить за него.
      if (hasDependencies && Number.isFinite(projectDeadlineTs) && endTs > projectDeadlineTs) {
        endTs = projectDeadlineTs;
        startTs = endTs - durationMs;

        if (Number.isFinite(depStartConstraint) && startTs < depStartConstraint) {
          startTs = depStartConstraint;
          endTs = Math.max(endTs, startTs + durationMs);
        }

        if (Number.isFinite(depEndConstraint) && endTs < depEndConstraint) {
          endTs = depEndConstraint;
          startTs = endTs - durationMs;
        }
      }
    }

    const startIso = new Date(startTs).toISOString();
    const endIso = new Date(endTs).toISOString();
    const finalEnd = endIso;

    const payload = {
      title: values.title.trim(),
      description: values.description.trim() || "Нет описания задачи",
      duration: durationDays,
      plannedStart: startIso,
      plannedEnd: new Date(endIso).toISOString(),
      deadline: new Date(finalEnd).toISOString(),
      autoScheduled: Boolean(values.deadline && !values.plannedStart),
      completionRule: values.completionRule,
      parentId: parentTask ? parentTask.id : null,
      assigneeIds: values.assigneeIds,
      dependencies: values.dependencies?.map((dep) => ({
        predecessorId: dep.predecessorId,
        type: dep.type,
        lag: dep.lag ?? 0,
      })),
      outcome: {
        description: values.outcomeDescription.trim() || "Результат не задан",
        acceptanceCriteria: values.outcomeAcceptanceCriteria.trim() || "Критерии не заданы",
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
      const baseOutcomeDescription = values.outcomeDescription.trim() || "Результат пока не задан";
      const baseOutcomeCriteria = values.outcomeAcceptanceCriteria.trim() || "Критерии пока не заданы";
      const baseDescription = values.description.trim() || "Описание проекта пока отсутствует";
      const payload: ProjectUpdatePayload = {
        title: values.title,
        description: baseDescription,
        outcome: {
          description: baseOutcomeDescription,
          acceptanceCriteria: baseOutcomeCriteria,
          deadline: new Date(values.outcomeDeadline).toISOString(),
          result: values.outcomeResult.trim() || undefined,
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

  const handleDeleteTaskSafe = async (taskId: string) => {
    if (!accessToken || !projectId) return;
    setSavingTask(true);
    setError(null);
    try {
      await deleteTask(accessToken, taskId);
      if (editingTask?.id === taskId) {
        setShowTaskModal(false);
        setEditingTask(null);
        setParentTask(null);
      }
      const updated = await listProjectTasks(accessToken, projectId);
      setTasks(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingTask(false);
    }
  };

  const handleCompleteTask = async (task: Task) => {
    if (!accessToken || !projectId) return;
    const resultInput = window.prompt("Добавьте результат выполнения (ссылка, текст)", task.outcome.result ?? "");
    const result = resultInput !== null ? resultInput.trim() : undefined;
    setSavingTask(true);
    setError(null);
    try {
      await completeTask(accessToken, task.id, result === "" ? null : result);
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
    setParentTask(null);
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

  const handleAddProjectReviewer = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !project) return;
    const email = projectReviewerEmail.trim();
    if (!email) {
      setReviewerError("Введите email ревьюера");
      return;
    }
    setSavingReviewer(true);
    setReviewerError(null);
    setReviewerMessage(null);
    try {
      await addProjectReviewer(accessToken, project.id, {
        reviewerEmail: email,
        comment: projectReviewerComment.trim() || undefined,
      });
      setReviewerMessage("Приглашение отправлено");
      setShowProjectReviewerModal(false);
      setProjectReviewerEmail("");
      setProjectReviewerComment("");
    } catch (err) {
      setReviewerError((err as Error).message);
    } finally {
      setSavingReviewer(false);
    }
  };

  const handleAddTaskReviewer = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !taskForReview) return;
    const email = taskReviewerEmail.trim();
    if (!email) {
      setReviewerError("Введите email ревьюера");
      return;
    }
    setSavingReviewer(true);
    setReviewerError(null);
    setReviewerMessage(null);
    try {
      await addTaskReviewer(accessToken, taskForReview.id, {
        reviewerEmail: email,
        comment: taskReviewerComment.trim() || undefined,
      });
      setReviewerMessage("Приглашение отправлено");
      setShowTaskReviewerModal(false);
      setTaskReviewerEmail("");
      setTaskReviewerComment("");
      setTaskForReview(null);
    } catch (err) {
      setReviewerError((err as Error).message);
    } finally {
      setSavingReviewer(false);
    }
  };

  const timeline = useMemo(() => buildTimeline(tasks), [tasks]);
  const axisTicks = useMemo(() => buildAxisTicks(timeline), [timeline]);
  const childrenMap = useMemo(() => buildChildrenMap(tasks), [tasks]);
  const isMember = Boolean(user && members.some((member) => member.id === user.id));
  const hasMembers = members.length > 0;

  return (
    <div className="stack">
      <ProjectPageHeader />

      {error && <p className="form-error">{error}</p>}

      <EditProjectModal
        open={showEditModal}
        project={project}
        loading={savingProject}
        onSubmit={handleUpdateProject}
        onClose={() => setShowEditModal(false)}
      />

      <TaskModal
        open={showTaskModal}
        tasks={tasks}
        loading={savingTask}
        initialTask={editingTask}
        parentTask={parentTask}
        assignees={assigneeOptions}
        members={members}
        onClose={closeTaskModal}
        onSubmit={handleSubmitTask}
      />

      <InviteModal
        open={showInviteModal && Boolean(project?.team_id)}
        inviteEmail={inviteEmail}
        inviteStatus={inviteStatus}
        invitesError={invitesError}
        loadingInvites={loadingInvites}
        onClose={() => setShowInviteModal(false)}
        onSubmit={handleCreateInvite}
        onEmailChange={setInviteEmail}
      />

      <ProjectReviewerModal
        open={showProjectReviewerModal && Boolean(project)}
        projectTitle={project?.title ?? ""}
        email={projectReviewerEmail}
        comment={projectReviewerComment}
        reviewerError={reviewerError}
        reviewerMessage={reviewerMessage}
        savingReviewer={savingReviewer}
        hasMembers={hasMembers}
        onClose={() => {
          setShowProjectReviewerModal(false);
          setProjectReviewerEmail("");
          setProjectReviewerComment("");
        }}
        onSubmit={handleAddProjectReviewer}
        onEmailChange={setProjectReviewerEmail}
        onCommentChange={setProjectReviewerComment}
      />

      <TaskReviewerModal
        open={showTaskReviewerModal && Boolean(taskForReview)}
        taskTitle={taskForReview?.title ?? ""}
        email={taskReviewerEmail}
        comment={taskReviewerComment}
        reviewerError={reviewerError}
        reviewerMessage={reviewerMessage}
        savingReviewer={savingReviewer}
        hasMembers={hasMembers}
        onClose={() => {
          setShowTaskReviewerModal(false);
          setTaskForReview(null);
          setTaskReviewerEmail("");
          setTaskReviewerComment("");
        }}
        onSubmit={handleAddTaskReviewer}
        onEmailChange={setTaskReviewerEmail}
        onCommentChange={setTaskReviewerComment}
      />

      <ProjectSummarySection
        project={project}
        loadingProject={loadingProject}
        savingProject={savingProject}
        onEditClick={() => setShowEditModal(true)}
      />

      {project?.reviews?.length ? (
        <section className="card">
          <h3>Ревью проекта</h3>
          <div className="stack" style={{ gap: "6px" }}>
            {project.reviews.map((rev) => (
              <div key={rev.id} className="project-meta">
                <span>
                  Статус: <strong>{rev.status}</strong>
                </span>
                {rev.comment && <span>Комментарий: {rev.comment}</span>}
                {rev.com_reviewer && <span>Комментарий ревьюера: {rev.com_reviewer}</span>}
                <span>Назначено: {new Date(rev.created_at).toLocaleString("ru-RU")}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="card">
          <h3>Ревью проекта</h3>
          <p className="muted">Пока нет ревью.</p>
        </section>
      )}

      <TeamSection
        project={project}
        members={members}
        loadingMembers={loadingMembers}
        membersError={membersError}
        isMember={isMember}
        leaving={leaving}
        userId={user?.id}
        onLeave={handleLeaveTeam}
      />

      <ProjectReviewRequestSection
        projectHasTeam={Boolean(project?.team_id)}
        savingReviewer={savingReviewer}
        onOpenModal={() => {
          setReviewerMessage(null);
          setReviewerError(null);
          setShowProjectReviewerModal(true);
        }}
      />

      <InvitesSection
        invites={invites}
        loadingInvites={loadingInvites}
        invitesError={invitesError}
        onOpenModal={() => setShowInviteModal(true)}
        onRevoke={handleRevokeInvite}
      />

      <TasksSection
        tasks={tasks}
        loadingTasks={loadingTasks}
        savingTask={savingTask}
        accessToken={accessToken}
        recalculating={recalculating}
        childrenMap={childrenMap}
        hasMembers={hasMembers}
        currentUserId={user?.id ?? null}
        onCreateTask={() => openTaskModal(null)}
        onEditTask={(task) => openTaskModal(task)}
        onCreateSubtask={(parent) => openTaskModal(null, parent)}
        onDeleteTask={handleDeleteTaskSafe}
        onRecalculate={handleRecalculateTasks}
        onRequestReview={(task) => {
          setTaskForReview(task);
          setShowTaskReviewerModal(true);
          setReviewerMessage(null);
          setReviewerError(null);
        }}
        onCompleteTask={(task) => void handleCompleteTask(task)}
      />

      <TimelineSection tasks={tasks} timeline={timeline} axisTicks={axisTicks} />
    </div>
  );
};

export default ProjectDetailPage;
