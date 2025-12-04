import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { listProjectReviews, listTaskReviews, type ProjectReview, type TaskReview, type ReviewStatus } from "../api/reviewApi";

const ReviewsPage = () => {
  const { accessToken } = useAuth();
  const [taskReviews, setTaskReviews] = useState<TaskReview[]>([]);
  const [projectReviews, setProjectReviews] = useState<ProjectReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewStatus | "all">("all");

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
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [accessToken, filter]);

  const renderStatus = (status: string) => {
    const cls = status === "Accepted" ? "tag tag--success" : status === "Rejected" ? "tag tag--danger" : "tag";
    return <span className={cls}>{status}</span>;
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
                      </div>
                      {renderStatus(rev.status)}
                    </div>
                    <p className="muted">Назначено: {new Date(rev.created_at).toLocaleString("ru-RU")}</p>
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
                      </div>
                      {renderStatus(rev.status)}
                    </div>
                    <p className="muted">Назначено: {new Date(rev.created_at).toLocaleString("ru-RU")}</p>
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
