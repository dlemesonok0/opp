import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { listCourses, type Course } from "../../courses/api/courseApi";
import {
  getProject,
  updateProject,
  type Project,
  type ProjectUpdatePayload,
} from "../api/projectApi";
import { createTask, listProjectTasks, type Task } from "../../tasks/api/taskApi";
import ProjectForm, { type ProjectFormValues } from "../components/ProjectForm";
import TaskForm, { type TaskFormValues } from "../../tasks/components/TaskForm";

type TimelineBounds = {
  min: number;
  max: number;
};

const toTs = (value: string) => new Date(value).getTime();

const buildTimeline = (tasks: Task[]): TimelineBounds | null => {
  if (tasks.length === 0) return null;

  let min = Number.MAX_SAFE_INTEGER;
  let max = 0;

  tasks.forEach((task) => {
    const start = toTs(task.planned_start);
    const end = toTs(task.planned_end);
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
  const { accessToken } = useAuth();

  const [courses, setCourses] = useState<Course[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);
  const [savingTask, setSavingTask] = useState(false);

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
    const loadCourses = async () => {
      if (!accessToken) {
        setLoadingCourses(false);
        return;
      }
      setLoadingCourses(true);
      setError(null);
      try {
        const data = await listCourses(accessToken);
        setCourses(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoadingCourses(false);
      }
    };

    void loadCourses();
  }, [accessToken]);

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

  const handleCreateTask = async (values: TaskFormValues) => {
    if (!accessToken || !projectId) return;
    setSavingTask(true);
    setError(null);
    try {
      await createTask(accessToken, projectId, {
        title: values.title,
        description: values.description,
        duration: values.duration,
        plannedStart: new Date(values.plannedStart).toISOString(),
        plannedEnd: new Date(values.plannedEnd).toISOString(),
        isMilestone: values.isMilestone,
        completionRule: values.completionRule,
        parentId: values.parentId || null,
        outcome: {
          description: values.outcomeDescription,
          acceptanceCriteria: values.outcomeAcceptanceCriteria,
          deadline: new Date(values.outcomeDeadline).toISOString(),
        },
      });
      const updated = await listProjectTasks(accessToken, projectId);
      setTasks(updated);
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
      const payload: ProjectUpdatePayload = {
        title: values.title,
        description: values.description,
        courseId: values.courseId || null,
        outcome: {
          description: values.outcomeDescription,
          acceptanceCriteria: values.outcomeAcceptanceCriteria,
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

  const timeline = useMemo(() => buildTimeline(tasks), [tasks]);

  const renderGanttBar = (task: Task) => {
    if (!timeline) return null;
    const start = toTs(task.planned_start);
    const end = toTs(task.planned_end);
    const range = Math.max(timeline.max - timeline.min, 1);
    const left = ((start - timeline.min) / range) * 100;
    const width = Math.max(((end - start) / range) * 100, 2);

    return (
      <div className="gantt-row" key={task.id}>
        <div className="gantt-row__label">
          <div className="gantt-row__title">{task.title}</div>
          <div className="gantt-row__meta">
            {new Date(task.planned_start).toLocaleDateString("ru-RU")} → {" "}
            {new Date(task.planned_end).toLocaleDateString("ru-RU")}
          </div>
        </div>
        <div className="gantt-row__track">
          <div
            className="gantt-bar"
            style={{ left: `${left}%`, width: `${width}%` }}
            aria-label={`${task.title}: ${task.planned_start} - ${task.planned_end}`}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="stack">
      <div className="table-header">
        <div>
          <h2>Проект</h2>
          <p className="muted">Задачи, сроки и прогресс команды</p>
        </div>
        <Link className="ghost-btn" to="/">
          ← К дашборду
        </Link>
      </div>

      {error && <p className="form-error">{error}</p>}

      {showEditModal && project && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal" style={{ minWidth: "640px" }}>
            <div className="table-header">
              <div>
                <h3>Редактировать проект</h3>
                <p className="muted">Название, описание, предмет и дедлайн</p>
              </div>
              <button className="ghost-btn" onClick={() => setShowEditModal(false)} aria-label="Закрыть">
                ✕
              </button>
            </div>
            {loadingCourses ? (
              <p>Загружаем предметы...</p>
            ) : (
              <ProjectForm
                mode="edit"
                courses={courses}
                initialProject={project}
                onSubmit={handleUpdateProject}
                onCancel={() => setShowEditModal(false)}
                loading={savingProject}
              />
            )}
          </div>
        </div>
      )}

      <section className="card">
        {loadingProject ? (
          <p>Загружаем данные проекта...</p>
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
                  <span className="tag">{project.course_id ? "Привязан к предмету" : "Без предмета"}</span>
                  <span className="muted">
                    Сдача: {new Date(project.outcome.deadline).toLocaleDateString("ru-RU")}
                  </span>
                  <button className="ghost-btn" onClick={() => setShowEditModal(true)} disabled={loadingCourses}>
                    {loadingCourses ? "Загружаем..." : "Редактировать"}
                  </button>
                </div>
              </div>
              <div className="info-block">
                <p className="muted">Критерии приёмки</p>
                <p>{project.outcome.acceptance_criteria}</p>
              </div>
          </div>
        )}
      </section>

      <section className="card">
        <TaskForm tasks={tasks} loading={savingTask} onSubmit={handleCreateTask} />
      </section>

      <section className="card">
        <div className="table-header">
          <div>
            <h3>Задачи</h3>
            <p className="muted">План работ и вех</p>
          </div>
          {loadingTasks && <span className="tag">Обновляем...</span>}
        </div>
        {loadingTasks ? (
          <p>Загружаем задачи...</p>
        ) : tasks.length === 0 ? (
          <p className="muted">В этом проекте ещё нет задач.</p>
        ) : (
          <div className="stack">
            {tasks.map((task) => (
              <article key={task.id} className="project-card">
                <header>
                  <div>
                    <h4>{task.title}</h4>
                    <p className="muted">{task.description}</p>
                  </div>
                  <span className="tag">{task.status}</span>
                </header>
                <div className="project-meta">
                  <span>
                    {new Date(task.planned_start).toLocaleDateString("ru-RU")} → {" "}
                    {new Date(task.planned_end).toLocaleDateString("ru-RU")}
                  </span>
                  <span>Правило завершения: {task.completion_rule}</span>
                  {task.is_milestone && <span>Веха</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="table-header">
          <div>
            <h3>Диаграмма Ганта</h3>
            <p className="muted">По плановым датам задач</p>
          </div>
        </div>
        {!timeline || tasks.length === 0 ? (
          <p className="muted">Нет данных для визуализации.</p>
        ) : (
          <div className="gantt-chart">
            {tasks.map((task) => renderGanttBar(task))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ProjectDetailPage;
