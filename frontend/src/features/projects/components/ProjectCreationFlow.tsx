import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { Course } from "../../courses/api/courseApi";
import { createCourse } from "../../courses/api/courseApi";
import type { Project } from "../api/projectApi";
import { createProject, updateProject } from "../api/projectApi";
import type { Team, TeamMember } from "../../teams/api/teamApi";
import { addTeamMember, createTeam, listTeamMembers } from "../../teams/api/teamApi";
import { searchUsers } from "../../users/api/userApi";

const emptyProjectValues = {
  title: "",
  description: "",
  outcomeDescription: "",
  outcomeCriteria: "",
  deadline: "",
};

type ProjectCreationFlowProps = {
  token: string | null;
  courses: Course[];
  onCourseRefresh: () => Promise<void> | void;
  onProjectRefresh: () => Promise<void> | void;
};

type Step = "course" | "project" | "team" | "done";

const ProjectCreationFlow = ({ token, courses, onCourseRefresh, onProjectRefresh }: ProjectCreationFlowProps) => {
  const [step, setStep] = useState<Step>("course");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseStatus, setCourseStatus] = useState<string | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [courseLoading, setCourseLoading] = useState(false);

  const [projectValues, setProjectValues] = useState({ ...emptyProjectValues });
  const [projectStatus, setProjectStatus] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState(false);
  const [project, setProject] = useState<Project | null>(null);

  const [teamName, setTeamName] = useState("Команда мечты");
  const [team, setTeam] = useState<Team | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);

  const [flowLog, setFlowLog] = useState<string[]>([]);

  useEffect(() => {
    if (!team || !token) {
      setMembers([]);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const data = await listTeamMembers(token, team.id);
        if (active) {
          setMembers(data);
        }
      } catch (error) {
        console.error(error);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [team, token]);

  const appendLog = (message: string) => {
    setFlowLog((prev) => [message, ...prev].slice(0, 6));
  };

  const resetFlow = () => {
    setStep("course");
    setSelectedCourse(null);
    setCourseTitle("");
    setCourseStatus(null);
    setCourseError(null);
    setProjectValues({ ...emptyProjectValues });
    setProjectStatus(null);
    setProjectError(null);
    setProject(null);
    setTeamName("Команда мечты");
    setTeam(null);
    setTeamError(null);
    setInviteEmail("");
    setInviteError(null);
    setMembers([]);
    setFlowLog([]);
  };

  const currentCourse = useMemo(() => {
    if (!selectedCourse) {
      return null;
    }
    return courses.find((course) => course.id === selectedCourse.id) ?? selectedCourse;
  }, [courses, selectedCourse]);

  const handleCourseSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const title = courseTitle.trim();
    if (!title) {
      setCourseError("Введите название предмета");
      return;
    }

    setCourseLoading(true);
    setCourseError(null);
    const existing = courses.find((course) => course.title.toLowerCase() === title.toLowerCase());
    if (existing) {
      setSelectedCourse(existing);
      setCourseStatus("Предмет найден. Можно сразу перейти к проекту.");
      setStep("project");
      appendLog(`Студент выбрал существующий предмет «${existing.title}».`);
      setCourseLoading(false);
      return;
    }

    try {
      const created = await createCourse(token, { title });
      setSelectedCourse(created);
      setCourseStatus("Создали новый предмет и сохранили его в системе.");
      appendLog(`Система создала предмет «${created.title}».`);
      setStep("project");
      await onCourseRefresh();
    } catch (error) {
      setCourseError((error as Error).message);
    } finally {
      setCourseLoading(false);
    }
  };

  const handleProjectSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !currentCourse) return;

  if (!projectValues.deadline) {
      setProjectError("Нужно указать дедлайн ожидаемого результата");
      return;
    }

    setProjectLoading(true);
    setProjectError(null);
    try {
      const created = await createProject(token, {
        title: projectValues.title,
        description: projectValues.description,
        courseId: currentCourse.id,
        outcome: {
          description: projectValues.outcomeDescription,
          acceptanceCriteria: projectValues.outcomeCriteria,
          deadline: new Date(projectValues.deadline).toISOString(),
        },
      });
      setProject(created);
      setProjectStatus("Проект создан и привязан к предмету.");
      appendLog(`Система создала проект «${created.title}».`);
      setStep("team");
      await onProjectRefresh();
    } catch (error) {
      setProjectError((error as Error).message);
    } finally {
      setProjectLoading(false);
    }
  };

  const handleTeamSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !project) return;

    const name = teamName.trim();
    if (!name) {
      setTeamError("Введите название команды");
      return;
    }

    setTeamLoading(true);
    setTeamError(null);
    try {
      const created = await createTeam(token, { name });
      setTeam(created);
      await updateProject(token, project.id, { teamId: created.id });
      appendLog(`Создана команда «${created.name}» и назначена на проект.`);
      await onProjectRefresh();
    } catch (error) {
      setTeamError((error as Error).message);
    } finally {
      setTeamLoading(false);
    }
  };

  const handleInviteSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token || !team) return;

    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setInviteError("Введите e-mail участника");
      return;
    }

    setInviteLoading(true);
    setInviteError(null);
    try {
      const users = await searchUsers(token, email, 5);
      const matched = users.find((user) => user.email.toLowerCase() === email);
      if (!matched) {
        setInviteError("Студент с таким email не найден");
        return;
      }
      await addTeamMember(token, team.id, { userId: matched.id });
      setInviteEmail("");
      appendLog(`Система отправила приглашение ${matched.email}.`);
      const updated = await listTeamMembers(token, team.id);
      setMembers(updated);
    } catch (error) {
      setInviteError((error as Error).message);
    } finally {
      setInviteLoading(false);
    }
  };

  useEffect(() => {
    if (members.length > 0 && step === "team") {
      setStep("done");
    }
  }, [members, step]);

  if (!token) {
    return <p className="muted">Авторизуйтесь, чтобы пользоваться флоу.</p>;
  }

  return (
    <div className="flow-wizard">
      <header>
        <h3>Флоу создания проекта</h3>
        <p className="muted">Следуйте шагам из схемы: предмет → проект → команда.</p>
      </header>
      <div className="flow-steps">
        {[
          { key: "course", label: "Предмет" },
          { key: "project", label: "Проект" },
          { key: "team", label: "Команда" },
          { key: "done", label: "Готово" },
        ].map((item, index) => (
          <div
            key={item.key}
            className={`flow-step ${step === item.key ? "active" : ""} ${[
              "course",
              "project",
              "team",
              "done",
            ].indexOf(step) > index ? "done" : ""}`}
          >
            <span>{index + 1}</span>
            <strong>{item.label}</strong>
          </div>
        ))}
      </div>

      {step === "course" && (
        <form className="form" onSubmit={handleCourseSubmit}>
          <div className="form-field">
            <label htmlFor="flow-course-title">Название предмета</label>
            <input
              id="flow-course-title"
              className="input"
              placeholder="Например, Проектный практикум"
              value={courseTitle}
              onChange={(event) => setCourseTitle(event.target.value)}
            />
          </div>
          <div className="form-actions">
            <button className="primary-btn" type="submit" disabled={courseLoading}>
              {courseLoading ? "Проверяем..." : "Проверить в системе"}
            </button>
          </div>
          {courseStatus && <p className="muted">{courseStatus}</p>}
          {courseError && <p className="form-error">{courseError}</p>}
        </form>
      )}

      {step === "project" && currentCourse && (
        <form className="form" onSubmit={handleProjectSubmit}>
          <div className="form-field">
            <label htmlFor="flow-course-select">Предмет</label>
            <select
              id="flow-course-select"
              className="input"
              value={currentCourse.id}
              onChange={(event) => {
                const next = courses.find((course) => course.id === event.target.value) ?? null;
                setSelectedCourse(next);
              }}
            >
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="flow-project-title">Название проекта</label>
            <input
              id="flow-project-title"
              className="input"
              value={projectValues.title}
              onChange={(event) => setProjectValues((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="flow-project-description">Описание</label>
            <textarea
              id="flow-project-description"
              className="input"
              rows={2}
              value={projectValues.description}
              onChange={(event) =>
                setProjectValues((prev) => ({ ...prev, description: event.target.value }))
              }
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="flow-project-outcome">Ожидаемый результат</label>
            <textarea
              id="flow-project-outcome"
              className="input"
              rows={2}
              value={projectValues.outcomeDescription}
              onChange={(event) =>
                setProjectValues((prev) => ({ ...prev, outcomeDescription: event.target.value }))
              }
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="flow-project-criteria">Критерии приёмки</label>
            <textarea
              id="flow-project-criteria"
              className="input"
              rows={2}
              value={projectValues.outcomeCriteria}
              onChange={(event) =>
                setProjectValues((prev) => ({ ...prev, outcomeCriteria: event.target.value }))
              }
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="flow-project-deadline">Дедлайн</label>
            <input
              id="flow-project-deadline"
              type="datetime-local"
              className="input"
              value={projectValues.deadline}
              onChange={(event) =>
                setProjectValues((prev) => ({ ...prev, deadline: event.target.value }))
              }
              required
            />
          </div>
          <div className="form-actions">
            <button className="ghost-btn" type="button" onClick={() => setStep("course")}>
              Назад
            </button>
            <button className="primary-btn" type="submit" disabled={projectLoading}>
              {projectLoading ? "Создаём..." : "Создать проект"}
            </button>
          </div>
          {projectStatus && <p className="muted">{projectStatus}</p>}
          {projectError && <p className="form-error">{projectError}</p>}
        </form>
      )}

      {step === "team" && project && (
        <form className="form" onSubmit={team ? handleInviteSubmit : handleTeamSubmit}>
          {!team ? (
            <>
              <div className="form-field">
                <label htmlFor="flow-team-name">Название команды</label>
                <input
                  id="flow-team-name"
                  className="input"
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  required
                />
              </div>
              <div className="form-actions">
                <button className="primary-btn" type="submit" disabled={teamLoading}>
                  {teamLoading ? "Создаём..." : "Создать и связать"}
                </button>
              </div>
              {teamError && <p className="form-error">{teamError}</p>}
            </>
          ) : (
            <>
              <div className="form-field">
                <label htmlFor="flow-invite-email">Пригласить участника</label>
                <input
                  id="flow-invite-email"
                  className="input"
                  placeholder="student@example.com"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                />
              </div>
              <div className="form-actions">
                <button className="primary-btn" type="submit" disabled={inviteLoading}>
                  {inviteLoading ? "Отправляем..." : "Добавить в команду"}
                </button>
                <button className="ghost-btn" type="button" onClick={() => setStep("done")}>
                  Завершить без приглашения
                </button>
              </div>
              {inviteError && <p className="form-error">{inviteError}</p>}
              {members.length > 0 && (
                <div className="info-block">
                  <h4>Текущие участники</h4>
                  <ul className="checklist">
                    {members.map((member) => (
                      <li key={member.id}>{member.full_name ?? member.email}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </form>
      )}

      {step === "done" && project && (
        <div className="info-block">
          <h4>Готово!</h4>
          <p>
            Проект «{project.title}» теперь связан с предметом «{currentCourse?.title}». Команда
            {team ? ` «${team.name}»` : ""} сформирована.
          </p>
          {members.length > 0 ? (
            <p className="muted">Приглашения отправлены всем участникам.</p>
          ) : (
            <p className="muted">Вы можете вернуться и пригласить студентов позже.</p>
          )}
          <div className="form-actions">
            <button className="primary-btn" type="button" onClick={resetFlow}>
              Создать ещё один проект
            </button>
          </div>
        </div>
      )}

      {flowLog.length > 0 && (
        <div className="flow-log">
          <h4>Журнал шагов</h4>
          <ul>
            {flowLog.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ProjectCreationFlow;
