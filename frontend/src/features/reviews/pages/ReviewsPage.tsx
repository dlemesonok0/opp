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
          <h2>My reviews</h2>
          <p className="muted">Tasks and projects where you are a reviewer</p>
        </div>
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All</option>
          <option value="Pending">Pending</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading ? (
        <p>Loading reviews...</p>
      ) : taskReviews.length === 0 && projectReviews.length === 0 ? (
        <p className="muted">No reviews assigned to you.</p>
      ) : (
        <>
          <section className="card">
            <div className="table-header">
              <div>
                <h3>Tasks</h3>
                <p className="muted">Tasks where you are reviewer</p>
              </div>
            </div>
            {taskReviews.length === 0 ? (
              <p className="muted">No task reviews.</p>
            ) : (
              <div className="stack">
                {taskReviews.map((rev) => (
                  <div key={rev.id} className="project-card">
                    <div className="table-header">
                      <div>
                        <strong>{rev.task.title}</strong>
                        <p className="muted">Project: {rev.task.project_id}</p>
                        {rev.comment && <p className="muted">Comment: {rev.comment}</p>}
                      </div>
                      {renderStatus(rev.status)}
                    </div>
                    <p className="muted">Assigned: {new Date(rev.created_at).toLocaleString("ru-RU")}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <div className="table-header">
              <div>
                <h3>Projects</h3>
                <p className="muted">Projects where you are reviewer</p>
              </div>
            </div>
            {projectReviews.length === 0 ? (
              <p className="muted">No project reviews.</p>
            ) : (
              <div className="stack">
                {projectReviews.map((rev) => (
                  <div key={rev.id} className="project-card">
                    <div className="table-header">
                      <div>
                        <strong>{rev.project.title}</strong>
                        {rev.comment && <p className="muted">Comment: {rev.comment}</p>}
                      </div>
                      {renderStatus(rev.status)}
                    </div>
                    <p className="muted">Assigned: {new Date(rev.created_at).toLocaleString("ru-RU")}</p>
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
