import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { getProjectReview, getTaskReview, updateProjectReview, updateTaskReview, viewProjectForReview, viewTaskForReview } from "../api/reviewApi";
import type { ReviewStatus, TaskReview, ProjectReview } from "../api/reviewApi";
import type { Task } from "../../tasks/api/taskApi";
import type { Project } from "../../projects/api/projectApi";

type Params = {
  kind: "tasks" | "projects";
  reviewId: string;
};

const ReviewViewPage = () => {
  const { kind, reviewId } = useParams<Params>();
  const { accessToken } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [review, setReview] = useState<TaskReview | ProjectReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<ReviewStatus>("Pending");
  const [comment, setComment] = useState("");
  const [comReviewer, setComReviewer] = useState("");

  const statusOptions = useMemo(
    () => [
      { value: "Pending", label: "В ожидании" },
      { value: "Accepted", label: "Принято" },
      { value: "Rejected", label: "Отклонено" },
    ],
    [],
  );

  useEffect(() => {
    const load = async () => {
      if (!accessToken || !reviewId || !kind) return;
      setLoading(true);
      setError(null);
      try {
        if (kind === "tasks") {
          const [rev, t] = await Promise.all([getTaskReview(accessToken, reviewId), viewTaskForReview(accessToken, reviewId)]);
          setReview(rev);
          setTask(t);
          setStatus(rev.status);
          setComment(rev.comment ?? "");
          setComReviewer(rev.com_reviewer ?? "");
        } else {
          const [rev, proj] = await Promise.all([getProjectReview(accessToken, reviewId), viewProjectForReview(accessToken, reviewId)]);
          setReview(rev);
          setProject(proj);
          setStatus(rev.status);
          setComment(rev.comment ?? "");
          setComReviewer(rev.com_reviewer ?? "");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [accessToken, kind, reviewId]);

  const handleSave = async () => {
    if (!accessToken || !review || !kind) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { status, comment: comment.trim() || null };
      if (kind === "tasks") {
        const updated = await updateTaskReview(accessToken, review.id, { ...payload, comReviewer: comReviewer.trim() || null });
        setReview(updated);
        setStatus(updated.status);
        setComment(updated.comment ?? "");
        setComReviewer(updated.com_reviewer ?? "");
      } else {
        const updated = await updateProjectReview(accessToken, review.id, { ...payload, comReviewer: comReviewer.trim() || null });
        setReview(updated);
        setStatus(updated.status);
        setComment(updated.comment ?? "");
        setComReviewer(updated.com_reviewer ?? "");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!kind || (kind !== "tasks" && kind !== "projects")) {
    return <p className="form-error">Неверный маршрут ревью.</p>;
  }

  return (
    <div className="stack">
      <div className="table-header">
        <div>
          <h2>Ревью {kind === "tasks" ? "задачи" : "проекта"}</h2>
          <p className="muted">Просмотр без возможности менять сам объект</p>
        </div>
        <button className="ghost-btn" type="button" onClick={() => navigate(-1)}>
          Назад
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Загружаем...</p>
      ) : kind === "tasks" && task ? (
        <section className="card">
          <h3>{task.title}</h3>
          <p className="muted">{task.description}</p>
          <div className="project-meta">
            <span>Статус: {task.status}</span>
            <span>
              Период: {new Date(task.planned_start).toLocaleString("ru-RU")} —{" "}
              {new Date(task.deadline ?? task.planned_end).toLocaleString("ru-RU")}
            </span>
            <span>Правило завершения: {task.completion_rule}</span>
            <span>Результат: {task.outcome.acceptance_criteria}</span>
            {task.outcome.result && <span>Фактический результат: {task.outcome.result}</span>}
          </div>
          <div className="stack" style={{ gap: "6px", marginTop: "10px" }}>
            <strong>Исполнители</strong>
            {task.assignees?.length ? (
              task.assignees.map((a) => (
                <span key={a.id} className="muted">
                  {a.user_id} — {a.is_completed ? "выполнил" : "ещё нет"}
                </span>
              ))
            ) : (
              <span className="muted">Исполнители не назначены</span>
            )}
          </div>
        </section>
      ) : kind === "projects" && project ? (
        <section className="card">
          <h3>{project.title}</h3>
          <p className="muted">{project.description}</p>
          <div className="project-meta">
            <span>Команда: {project.team_id ?? "не указана"}</span>
            <span>Дедлайн результата: {new Date(project.outcome.deadline).toLocaleString("ru-RU")}</span>
          </div>
          <div className="stack" style={{ gap: "4px", marginTop: "8px" }}>
            <strong>Критерии успеха</strong>
            <p className="muted">{project.outcome.acceptance_criteria}</p>
            {project.outcome.result && <p className="muted">Фактический результат: {project.outcome.result}</p>}
          </div>
        </section>
      ) : (
        <p className="muted">Данные ревью недоступны.</p>
      )}

      {review && (
        <section className="card">
          <h3>Ваше ревью</h3>
          <div className="stack" style={{ gap: "8px" }}>
            <div className="stack" style={{ gap: "4px" }}>
              <label htmlFor="status" className="muted">
                Статус
              </label>
              <select
                id="status"
                className="input"
                value={status}
                onChange={(e) => setStatus(e.target.value as ReviewStatus)}
                disabled={saving}
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="stack" style={{ gap: "4px" }}>
              <label htmlFor="comment" className="muted">
                Комментарий
              </label>
              <textarea
                id="comment"
                className="input"
                rows={4}
                placeholder="Опишите вывод или замечания"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="stack" style={{ gap: "4px" }}>
              <label htmlFor="comReviewer" className="muted">
                Комментарий ревьюера (видят участники)
              </label>
              <textarea
                id="comReviewer"
                className="input"
                rows={3}
                placeholder="Сообщение команде"
                value={comReviewer}
                onChange={(e) => setComReviewer(e.target.value)}
                disabled={saving}
              />
            </div>
            <button className="primary-btn" type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Сохраняем..." : "Сохранить ревью"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default ReviewViewPage;
