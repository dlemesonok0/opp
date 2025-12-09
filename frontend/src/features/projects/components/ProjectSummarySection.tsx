import type { Project } from "../api/projectApi";

type ProjectSummarySectionProps = {
  project: Project | null;
  loadingProject: boolean;
  savingProject: boolean;
  onEditClick: () => void;
};

const ProjectSummarySection = ({ project, loadingProject, savingProject, onEditClick }: ProjectSummarySectionProps) => (
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
              Дедлайн результата: {new Date(project.outcome.deadline).toLocaleDateString("ru-RU")}
            </span>
            <button className="ghost-btn" onClick={onEditClick}>
              {savingProject ? "Сохраняем..." : "Редактировать"}
            </button>
          </div>
        </div>
        <div className="info-block">
          <p className="muted">Критерии успеха</p>
          <p>{project.outcome.acceptance_criteria}</p>
          {project.outcome.result && <p className="muted">Фактический результат: {project.outcome.result}</p>}
        </div>
      </div>
    )}
  </section>
);

export default ProjectSummarySection;
