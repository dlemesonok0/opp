import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { listCourses } from "../../features/courses/api/courseApi";
import type { Course } from "../../features/courses/api/courseApi";
import {
  createProject,
  listMyProjects,
  type ProjectMembership,
} from "../../features/projects/api/projectApi";
import { addTeamMember, createTeam } from "../../features/teams/api/teamApi";

const DashboardPage = () => {
  const { accessToken, user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [myProjects, setMyProjects] = useState<ProjectMembership[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [formCourseId, setFormCourseId] = useState<string>("");
  const [projectTitle, setProjectTitle] = useState("");
  const [formStatus, setFormStatus] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (!accessToken) return;
    setLoadingCourses(true);
    setCoursesError(null);
    try {
      const data = await listCourses(accessToken);
      setCourses(data);
    } catch (error) {
      setCoursesError((error as Error).message);
    } finally {
      setLoadingCourses(false);
    }
  }, [accessToken]);

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
    void fetchCourses();
    void fetchMyProjects();
  }, [fetchCourses, fetchMyProjects]);

  useEffect(() => {
    if (!formCourseId && courses.length > 0) {
      setFormCourseId(courses[0].id);
    }
  }, [courses, formCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === formCourseId) ?? null,
    [courses, formCourseId]
  );

  const handleCreateTeam = async (event: FormEvent) => {
    event.preventDefault();
    if (!accessToken || !user) return;

    const title = projectTitle.trim();
    if (!title) {
      setFormError("Введите название проекта");
      return;
    }
    if (!selectedCourse) {
      setFormError("Нужен хотя бы один предмет");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    setFormStatus(null);
    try {
      const teamName = `${title} — команда`;
      const team = await createTeam(accessToken, { name: teamName });
      await addTeamMember(accessToken, team.id, { userId: user.id });

      const deadline = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      await createProject(accessToken, {
        title,
        description: `Команда работает над проектом «${title}» в рамках курса «${selectedCourse.title}».`,
        courseId: selectedCourse.id,
        teamId: team.id,
        outcome: {
          description: `Демо-проект «${title}» с отчетом о проделанной работе.`,
          acceptanceCriteria: "Готова презентация, показано демо и собраны отзывы наставника.",
          deadline: deadline.toISOString(),
        },
      });

      setProjectTitle("");
      setFormStatus("Команда создана, вы добавлены в участники и проект готов.");
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
            <h2>Ваши проекты</h2>
            <p className="muted">
              Здесь собраны команды, где вы состоите. Создайте новый проект и команду за пару кликов.
            </p>
          </div>
          <div className="dashboard-hero__stats">
            <span className="stat-pill">{totalProjects} проектов</span>
            <span className="stat-pill">{courses.length} предметов</span>
            <button className="primary-btn" onClick={openCreateModal} disabled={loadingCourses}>
              Создать проект
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="table-header">
          <div>
            <h3>Мои проекты</h3>
            <p className="muted">Команды, в которых вы состоите</p>
          </div>
          {loadingProjects && <span className="tag">Обновляем...</span>}
        </div>
        {projectsError && <p className="form-error">{projectsError}</p>}
        {loadingProjects ? (
          <p>Загружаем список...</p>
        ) : myProjects.length === 0 ? (
          <div className="dashboard-empty">
            <p>Пока нет ни одного проекта. Создайте первый.</p>
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
                  <span className="tag">{project.course_title ?? "Без предмета"}</span>
                </header>
                <div className="project-meta">
                  <span>Команда: {project.team_name ?? "не назначена"}</span>
                  <span>
                    Сдача: {new Date(project.outcome.deadline).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <span className="muted">Открыть проект →</span>
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
                <h3>Создать проект</h3>
                <p className="muted">Выберите предмет и придумайте название</p>
              </div>
              <button className="ghost-btn" onClick={closeCreateModal} aria-label="Закрыть">
                ✕
              </button>
            </div>

            {coursesError && <p className="form-error">{coursesError}</p>}
            {loadingCourses ? (
              <p>Загружаем список предметов...</p>
            ) : courses.length === 0 ? (
              <div className="dashboard-empty">
                <p>Нет предметов. Добавьте хотя бы один на странице предметов.</p>
                <Link className="primary-btn" to="/courses">
                  Перейти к предметам
                </Link>
              </div>
            ) : (
              <form className="form" onSubmit={handleCreateTeam}>
                <div className="form-field">
                  <label htmlFor="dashboard-course">Предмет</label>
                  <select
                    id="dashboard-course"
                    className="input"
                    value={formCourseId}
                    onChange={(event) => setFormCourseId(event.target.value)}
                  >
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor="dashboard-project">Название проекта</label>
                  <input
                    id="dashboard-project"
                    className="input"
                    value={projectTitle}
                    onChange={(event) => setProjectTitle(event.target.value)}
                    placeholder="Например, Платформа наставника"
                  />
                </div>
                <div className="form-actions">
                  <button className="ghost-btn" type="button" onClick={closeCreateModal}>
                    Отменить
                  </button>
                  <button className="primary-btn" type="submit" disabled={formLoading}>
                    {formLoading ? "Создаём..." : "Создать"}
                  </button>
                </div>
                {formStatus && <p className="muted">{formStatus}</p>}
                {formError && <p className="form-error">{formError}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
