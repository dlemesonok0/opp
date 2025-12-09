import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import {
  listProjectReviews,
  listTaskReviews,
  updateProjectReview,
  updateTaskReview,
  type ProjectReview,
  type TaskReview,
  type ReviewStatus,
} from "../api/reviewApi";

const ReviewsPage = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [taskReviews, setTaskReviews] = useState<TaskReview[]>([]);
  const [projectReviews, setProjectReviews] = useState<ProjectReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [statusMap, setStatusMap] = useState<Record<string, ReviewStatus>>({});

  useEffect(() => {
    const load = async () => {
      if (!accessToken) return;
      setLoading(true);
      setError(null);
      try {
        const statusParam = filter === "all" ? undefined : filter;
        const [tasks, projects] = await Promise.all([
          listTaskReviews(accessToken, statusParam),
          listProjectReviews(accessToken, statusParam),
        ]);
        setTaskReviews(tasks);
        setProjectReviews(projects);
        const nextComments: Record<string, string> = {};
        const nextStatuses: Record<string, ReviewStatus> = {};
        tasks.forEach((rev) => {
          nextComments[rev.id] = rev.comment ?? "";
          nextStatuses[rev.id] = rev.status;
        });
        projects.forEach((rev) => {
          nextComments[rev.id] = rev.comment ?? "";
          nextStatuses[rev.id] = rev.status;
        });
        setCommentMap(nextComments);
        setStatusMap(nextStatuses);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [accessToken, filter]);

  const statusOptions: Array<{ value: ReviewStatus; label: string }> = useMemo(
    () => [
      { value: "Pending", label: "В ожидании" },
      { value: "Accepted", label: "Принято" },
      { value: "Rejected", label: "Отклонено" },
    ],
    [],
  );

  const renderStatus = (status: string) => {
    const cls = status === "Accepted" ? "tag tag--success" : status === "Rejected" ? "tag tag--danger" : "tag";
    const item = statusOptions.find((o) => o.value === status);
    return <span className={cls}>{item?.label ?? status}</span>;
  };

  const handleSaveTaskReview = async (rev: TaskReview) => {
    if (!accessToken) return;
    setSavingMap((prev) => ({ ...prev, [rev.id]: true }));
    setError(null);
    try {
      const payload = {
        status: statusMap[rev.id] ?? rev.status,
        comment: (commentMap[rev.id] ?? "").trim() || null,
      };
      const updated = await updateTaskReview(accessToken, rev.id, payload);
      setTaskReviews((prev) => prev.map((r) => (r.id === rev.id ? updated : r)));
      setCommentMap((prev) => ({ ...prev, [rev.id]: updated.comment ?? "" }));
      setStatusMap((prev) => ({ ...prev, [rev.id]: updated.status }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingMap((prev) => ({ ...prev, [rev.id]: false }));
    }
  };

  const handleSaveProjectReview = async (rev: ProjectReview) => {
    if (!accessToken) return;
    setSavingMap((prev) => ({ ...prev, [rev.id]: true }));
    setError(null);
    try {
      const payload = {
        status: statusMap[rev.id] ?? rev.status,
        comment: (commentMap[rev.id] ?? "").trim() || null,
      };
      const updated = await updateProjectReview(accessToken, rev.id, payload);
      setProjectReviews((prev) => prev.map((r) => (r.id === rev.id ? updated : r)));
      setCommentMap((prev) => ({ ...prev, [rev.id]: updated.comment ?? "" }));
      setStatusMap((prev) => ({ ...prev, [rev.id]: updated.status }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingMap((prev) => ({ ...prev, [rev.id]: false }));
    }
  };

  return (
    <div className="stack">
      <div className="table-header">
        <div>
          <h2>Мои ревью</h2>
          <p className="muted">Задачи и проекты, где вы назначены ревьюером</p>
        </div>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Все</option>
          <option value="Pending">В ожидании</option>
          <option value="Accepted">Принято</option>
          <option value="Rejected">Отклонено</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Загружаем ревью...</p>
      ) : taskReviews.length === 0 && projectReviews.length === 0 ? (
        <p className="muted">У вас пока нет ревью.</p>
      ) : (
        <>
          <section className="card">
            <div className="table-header">
              <div>
                <h3>Задачи</h3>
                <p className="muted">Задачи, где вы ревьюер</p>
              </div>
            </div>
            {taskReviews.length === 0 ? (
              <p className="muted">Нет задач на ревью.</p>
            ) : (
              <div className="stack">
                {taskReviews.map((rev) => (
                  <div key={rev.id} className="project-card">
                    <div className="table-header">
                      <div>
                        <strong>{rev.task.title}</strong>
                        <p className="muted">
                          Project: {rev.task.project_title || rev.task.project_id}
                        </p>
                        {rev.comment && <p className="muted">Комментарий: {rev.comment}</p>}
                        {rev.com_reviewer && <p className="muted">Комментарий ревьюера: {rev.com_reviewer}</p>}
                      </div>
                      {renderStatus(rev.status)}
                    </div>
                    <p className="muted">Назначено: {new Date(rev.created_at).toLocaleString("ru-RU")}</p>
                    <div className="stack" style={{ gap: "8px", marginTop: "8px" }}>
                      <div className="stack" style={{ gap: "4px" }}>
                        <label className="muted" htmlFor={`status-${rev.id}`}>
                          Статус ревью
                        </label>
                        <select
                          id={`status-${rev.id}`}
                          className="input"
                          value={statusMap[rev.id] ?? rev.status}
                          onChange={(e) => setStatusMap((prev) => ({ ...prev, [rev.id]: e.target.value as ReviewStatus }))}
                          disabled={savingMap[rev.id]}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="stack" style={{ gap: "4px" }}>
                        <label className="muted" htmlFor={`comment-${rev.id}`}>
                          Комментарий
                        </label>
                        <textarea
                          id={`comment-${rev.id}`}
                          className="input"
                          rows={3}
                          placeholder="Напишите, что улучшить или подтвердите выполнение"
                          value={commentMap[rev.id] ?? ""}
                          onChange={(e) => setCommentMap((prev) => ({ ...prev, [rev.id]: e.target.value }))}
                          disabled={savingMap[rev.id]}
                        />
                      </div>
                      <div className="table-actions">
                        <button className="ghost-btn" type="button" onClick={() => navigate(`/reviews/tasks/${rev.id}`)}>
                          Открыть ревью
                        </button>
                        <button
                          className="primary-btn"
                          type="button"
                          onClick={() => void handleSaveTaskReview(rev)}
                          disabled={savingMap[rev.id]}
                        >
                          {savingMap[rev.id] ? "Сохраняем..." : "Сохранить ревью"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="table-header">
              <div>
                <h3>Проекты</h3>
                <p className="muted">Проекты, где вы ревьюер</p>
              </div>
            </div>
            {projectReviews.length === 0 ? (
              <p className="muted">Нет проектов на ревью.</p>
            ) : (
              <div className="stack">
                {projectReviews.map((rev) => (
                  <div key={rev.id} className="project-card">
                    <div className="table-header">
                      <div>
                        <strong>{rev.project.title}</strong>
                        {rev.comment && <p className="muted">Комментарий: {rev.comment}</p>}
                        {rev.com_reviewer && <p className="muted">Комментарий ревьюера: {rev.com_reviewer}</p>}
                      </div>
                      {renderStatus(rev.status)}
                    </div>
                    <p className="muted">Назначено: {new Date(rev.created_at).toLocaleString("ru-RU")}</p>
                    <div className="stack" style={{ gap: "8px", marginTop: "8px" }}>
                      <div className="stack" style={{ gap: "4px" }}>
                        <label className="muted" htmlFor={`status-${rev.id}`}>
                          Статус ревью
                        </label>
                        <select
                          id={`status-${rev.id}`}
                          className="input"
                          value={statusMap[rev.id] ?? rev.status}
                          onChange={(e) => setStatusMap((prev) => ({ ...prev, [rev.id]: e.target.value as ReviewStatus }))}
                          disabled={savingMap[rev.id]}
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="stack" style={{ gap: "4px" }}>
                        <label className="muted" htmlFor={`comment-${rev.id}`}>
                          Комментарий
                        </label>
                        <textarea
                          id={`comment-${rev.id}`}
                          className="input"
                          rows={3}
                          placeholder="Напишите вывод по проекту"
                          value={commentMap[rev.id] ?? ""}
                          onChange={(e) => setCommentMap((prev) => ({ ...prev, [rev.id]: e.target.value }))}
                          disabled={savingMap[rev.id]}
                        />
                      </div>
                      <div className="table-actions">
                        <button className="ghost-btn" type="button" onClick={() => navigate(`/reviews/projects/${rev.id}`)}>
                          Открыть ревью
                        </button>
                        <button
                          className="primary-btn"
                          type="button"
                          onClick={() => void handleSaveProjectReview(rev)}
                          disabled={savingMap[rev.id]}
                        >
                          {savingMap[rev.id] ? "Сохраняем..." : "Сохранить ревью"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default ReviewsPage;
