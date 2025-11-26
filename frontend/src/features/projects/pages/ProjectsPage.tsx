import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import ProjectForm, { type ProjectFormValues } from "../components/ProjectForm";
import {
  createProject,
  deleteProject,
  listMyProjects,
  updateProject,
} from "../api/projectApi";
import type {
  ProjectCreatePayload,
  ProjectMembership,
  ProjectUpdatePayload,
} from "../api/projectApi";

const ProjectsPage = () => {
  const { accessToken } = useAuth();
  const [projects, setProjects] = useState<ProjectMembership[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectMembership | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!accessToken) return;
    setLoadingProjects(true);
    setError(null);
    try {
      const data = await listMyProjects(accessToken);
      setProjects(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingProjects(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleSubmit = async (values: ProjectFormValues) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      if (editingProject) {
        const payload: ProjectUpdatePayload = {
          title: values.title,
          description: values.description,
          outcome: {
            description: values.outcomeDescription,
            acceptanceCriteria: values.outcomeAcceptanceCriteria,
            deadline: new Date(values.outcomeDeadline).toISOString(),
          },
        };
        await updateProject(accessToken, editingProject.id, payload);
        setEditingProject(null);
      } else {
        const payload: ProjectCreatePayload = {
          title: values.title,
          description: values.description,
          outcome: {
            description: values.outcomeDescription,
            acceptanceCriteria: values.outcomeAcceptanceCriteria,
            deadline: new Date(values.outcomeDeadline).toISOString(),
          },
        };
        await createProject(accessToken, payload);
      }
      await fetchProjects();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      await deleteProject(accessToken, id);
      if (editingProject?.id === id) {
        setEditingProject(null);
      }
      await fetchProjects();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid">
      <section className="card">
        <div className="table-header">
          <div>
            <h3>Проекты</h3>
            <p className="muted">Описание, сроки и состав команды</p>
          </div>
          {saving && <span className="tag">Сохраняем...</span>}
        </div>
        {error && <p className="form-error">{error}</p>}
        {loadingProjects ? (
          <p>Загружаем проекты...</p>
        ) : projects.length === 0 ? (
          <p>Проектов пока нет</p>
        ) : (
          <div className="stack">
            {projects.map((project) => (
              <article key={project.id} className="project-card">
                <header>
                  <div>
                    <h4>{project.title}</h4>
                    <p className="muted">{project.description}</p>
                  </div>
                  <span className="tag">{project.team_name ?? "Без команды"}</span>
                </header>
                <dl>
                  <div>
                    <dt>Критерии приемки</dt>
                    <dd>{project.outcome.acceptance_criteria}</dd>
                  </div>
                  <div>
                    <dt>Дедлайн</dt>
                    <dd>{new Date(project.outcome.deadline).toLocaleString("ru-RU")}</dd>
                  </div>
                </dl>
                <div className="table-actions">
                  <button className="ghost-btn" onClick={() => setEditingProject(project)}>
                    Редактировать
                  </button>
                  <button className="danger-btn" onClick={() => handleDelete(project.id)}>
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <ProjectForm
          mode={editingProject ? "edit" : "create"}
          initialProject={editingProject}
          onSubmit={handleSubmit}
          onCancel={() => setEditingProject(null)}
          loading={saving}
        />
      </section>
    </div>
  );
};

export default ProjectsPage;
