import {useCallback, useEffect, useState} from "react";
import {useAuth} from "../../../auth/AuthContext";
import type {Course} from "../../courses/api/courseApi";
import {listCourses} from "../../courses/api/courseApi";
import type {ProjectFormValues} from "../components/ProjectForm";
import type {ProjectCreatePayload, ProjectMembership, ProjectUpdatePayload,} from "../api/projectApi";
import {createProject, deleteProject, listMyProjects, updateProject,} from "../api/projectApi";

const ProjectsPage = () => {
    const {accessToken} = useAuth();
    const [projects, setProjects] = useState<ProjectMembership[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectMembership | null>(null);

    const fetchCourses = useCallback(async () => {
        if (!accessToken) return;
        setLoadingCourses(true);
        setError(null);
        try {
            const data = await listCourses(accessToken);
            setCourses(data);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoadingCourses(false);
        }
    }, [accessToken]);

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
        void fetchCourses();
        void fetchProjects();
    }, [fetchCourses, fetchProjects]);

    const handleSubmit = async (values: ProjectFormValues) => {
        if (!accessToken) return;
        setSaving(true);
        setError(null);
        try {
            if (editingProject) {
                const payload: ProjectUpdatePayload = {
                    title: values.title,
                    description: values.description,
                    courseId: values.courseId || null,
                };
                await updateProject(accessToken, editingProject.id, payload);
                setEditingProject(null);
            } else {
                const payload: ProjectCreatePayload = {
                    title: values.title,
                    description: values.description,
                    courseId: values.courseId || null,
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

    const resolveCourseTitle = (courseId: string | null) => {
        if (!courseId) return "Без предмета";
        const found = courses.find((course) => course.id === courseId);
        return found?.title ?? "Без названия";
    };

    return (
        <div className="grid">
            <section className="card">
                <div className="table-header">
                    <div>
                        <h3>Проекты</h3>
                        <p className="muted">Описание, предмет и сроки</p>
                    </div>
                    {saving && <span className="tag">Сохраняем...</span>}
                </div>
                {loadingProjects ? (
                    <p>Загружаем проекты...</p>
                ) : projects.length === 0 ? (
                    <p>Проекты не созданы</p>
                ) : (
                    <div className="stack">
                        {projects.map((project) => (
                            <article key={project.id} className="project-card">
                                <header>
                                    <div>
                                        <h4>{project.title}</h4>
                                        <p className="muted">{project.description}</p>
                                    </div>
                                    <span className="tag">{resolveCourseTitle(project.course_id)}</span>
                                </header>
                                <dl>
                                    <div>
                                        <dt>Критерии приёмки</dt>
                                        <dd>{project.outcome.acceptance_criteria}</dd>
                                    </div>
                                    <div>
                                        <dt>Сдача</dt>
                                        <dd>{new Date(project.outcome.deadline).toLocaleString("ru-RU")}</dd>
                                    </div>
                                </dl>
                                <div className="table-actions">
                                    <button className="ghost-btn" onClick={() => setEditingProject(project)}>
                                        Править
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
        </div>
    );
};

export default ProjectsPage;
