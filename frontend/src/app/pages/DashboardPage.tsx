import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  createProject,
  listMyProjects,
  type ProjectMembership,
} from "../../features/projects/api/projectApi";
import { addTeamMember, createTeam } from "../../features/teams/api/teamApi";

const DashboardPage = () => {
  const { accessToken, user } = useAuth();
  const [myProjects, setMyProjects] = useState<ProjectMembership[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectOutcomeDescription, setProjectOutcomeDescription] = useState("");
  const [projectOutcomeCriteria, setProjectOutcomeCriteria] = useState("");
  const [projectOutcomeDeadline, setProjectOutcomeDeadline] = useState<string>("");
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const defaultOutcomeDeadline = () =>
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 16);

  const fetchMyProjects = useCallback(async () => {
    if (!accessToken) return;
    setLoadingProjects(true);
    setProjectsError(null);
    try {
      const data = await listMyProjects(accessToken);
      setMyProjects(data);
    } catch (error) {
      setProjectsError((error as Error).message);
    } finally {
      setLoadingProjects(false);
    }
  }, [accessToken]);

  useEffect(() => {
    setProjectOutcomeDeadline(defaultOutcomeDeadline());
    void fetchMyProjects();
  }, [fetchMyProjects]);

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !user) return;

    const title = projectTitle.trim();
    if (!title) {
      setFormError("Нужно название проекта");
      return;
    }
    if (!projectDescription.trim()) {
      setFormError("Опишите проект");
      return;
    }
    if (!projectOutcomeDescription.trim() || !projectOutcomeCriteria.trim()) {
      setFormError("Заполните описание результата и критерии приемки");
      return;
    }

    const deadlineDate = new Date(projectOutcomeDeadline);
    if (!Number.isFinite(deadlineDate.getTime())) {
      setFormError("Неверный формат дедлайна");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    setFormStatus(null);
    try {
      const teamName = `${title} — команда`;
      const team = await createTeam(accessToken, { name: teamName });
      await addTeamMember(accessToken, team.id, { userId: user.id });

      await createProject(accessToken, {
        title,
        description: projectDescription,
        teamId: team.id,
        outcome: {
          description: projectOutcomeDescription,
          acceptanceCriteria: projectOutcomeCriteria,
          deadline: deadlineDate.toISOString(),
        },
      });

      setProjectTitle("");
      setProjectDescription("");
      setProjectOutcomeDescription("");
      setProjectOutcomeCriteria("");
      setProjectOutcomeDeadline(defaultOutcomeDeadline());
      setFormStatus("Проект создан, можно переходить к задачам");
      setShowCreateModal(false);
      await fetchMyProjects();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setFormLoading(false);
    }
  };

  const totalProjects = myProjects.length;

  const openCreateModal = () => {
    setFormError(null);
    setFormStatus(null);
    setProjectTitle("");
    setProjectDescription("");
    setProjectOutcomeDescription("");
    setProjectOutcomeCriteria("");
    setProjectOutcomeDeadline(defaultOutcomeDeadline());
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (formLoading) return;
    setShowCreateModal(false);
  };

  return (
    <div className="stack">
      <section className="card">
        <div className="dashboard-hero">
          <div>
            <h2>Рабочий стол</h2>
            <p className="muted">
              Управляйте проектами и командами из одного места. Создавайте проект и сразу переходите
              к задачам.
            </p>
          </div>
          <div className="dashboard-hero__stats">
            <span className="stat-pill">{totalProjects} проектов</span>
            <button className="primary-btn" onClick={openCreateModal}>
              Новый проект
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-header">
          <div>
            <h3>Мои проекты</h3>
            <p className="muted">Описание, команда и сроки</p>
          </div>
          {loadingProjects && <span className="tag">Загружаем...</span>}
        </div>
        {projectsError && <p className="form-error">{projectsError}</p>}
        {loadingProjects ? (
          <p>Загружаем проекты...</p>
        ) : myProjects.length === 0 ? (
          <div className="dashboard-empty">
            <p>У вас пока нет проектов. Создайте первый.</p>
          </div>
        ) : (
          <div className="stack">
            {myProjects.map((project) => (
              <Link
                to={`/projects/${project.id}`}
                key={project.id}
                className="project-card clickable-card"
              >
                <header>
                  <div>
                    <h4>{project.title}</h4>
                    <p className="muted">{project.description}</p>
                  </div>
                  <span className="tag">{project.team_name ?? "Без команды"}</span>
                </header>
                <div className="project-meta">
                  <span>Команда: {project.team_name ?? "пока не назначена"}</span>
                  <span>
                    Дедлайн: {new Date(project.outcome.deadline).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <span className="muted">Открыть проект</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {showCreateModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="table-header">
              <div>
                <h3>Новый проект</h3>
                <p className="muted">Название, описание и параметры результата</p>
              </div>
              <button className="ghost-btn" onClick={closeCreateModal} aria-label="Закрыть">
                ✕
              </button>
            </div>

            <form className="form" onSubmit={handleCreateProject}>
              <div className="form-field">
                <label htmlFor="dashboard-project">Название</label>
                <input
                  id="dashboard-project"
                  className="input"
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  placeholder="Пример: Финальный проект"
                />
              </div>
              <div className="form-field">
                <label htmlFor="dashboard-project-description">Описание</label>
                <textarea
                  id="dashboard-project-description"
                  className="input"
                  rows={3}
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  placeholder="Что нужно сделать и зачем"
                />
              </div>
              <div className="form-field">
                <label htmlFor="dashboard-outcome-description">Описание результата</label>
                <textarea
                  id="dashboard-outcome-description"
                  className="input"
                  rows={2}
                  value={projectOutcomeDescription}
                  onChange={(event) => setProjectOutcomeDescription(event.target.value)}
                  placeholder="Что должно получиться в итоге"
                />
              </div>
              <div className="form-field">
                <label htmlFor="dashboard-outcome-criteria">Критерии приемки</label>
                <textarea
                  id="dashboard-outcome-criteria"
                  className="input"
                  rows={2}
                  value={projectOutcomeCriteria}
                  onChange={(event) => setProjectOutcomeCriteria(event.target.value)}
                  placeholder="Как поймем, что работа завершена"
                />
              </div>
              <div className="form-field">
                <label htmlFor="dashboard-outcome-deadline">Дедлайн</label>
                <input
                  id="dashboard-outcome-deadline"
                  type="datetime-local"
                  className="input"
                  value={projectOutcomeDeadline}
                  onChange={(event) => setProjectOutcomeDeadline(event.target.value)}
                />
              </div>
              <div className="form-actions">
                <button className="ghost-btn" type="button" onClick={closeCreateModal}>
                  Отмена
                </button>
                <button className="primary-btn" type="submit" disabled={formLoading}>
                  {formLoading ? "Создаем..." : "Создать"}
                </button>
              </div>
              {formStatus && <p className="muted">{formStatus}</p>}
              {formError && <p className="form-error">{formError}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
