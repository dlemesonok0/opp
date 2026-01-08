import { useState } from "react";
import type { Task, TaskComment } from "../../tasks/api/taskApi";
import { addTaskComment, listTaskComments } from "../../tasks/api/taskApi";

type TasksSectionProps = {
  tasks: Task[];
  loadingTasks: boolean;
  savingTask: boolean;
  accessToken: string | null;
  projectDeadline: string | null;
  childrenMap: Map<string, Task[]>;
  hasMembers: boolean;
  currentUserId: string | null;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
  onCreateSubtask: (parent: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onRequestReview: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
  onCancelTask: (task: Task) => void;
  onReopenTask: (task: Task) => void;
  onRecalculate: () => void;
  recalculating: boolean;
};

const TasksSection = ({
  tasks,
  loadingTasks,
  savingTask,
  accessToken,
  projectDeadline,
  childrenMap,
  hasMembers,
  currentUserId,
  onCreateTask,
  onEditTask,
  onCreateSubtask,
  onDeleteTask,
  onRequestReview,
  onCompleteTask,
  onCancelTask,
  onReopenTask,
  onRecalculate,
  recalculating,
}: TasksSectionProps) => {
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [commentsByTask, setCommentsByTask] = useState<Record<string, TaskComment[]>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});
  const [commentsError, setCommentsError] = useState<Record<string, string | null>>({});
  const [commentsSaving, setCommentsSaving] = useState<Record<string, boolean>>({});

  const toggleComments = async (taskId: string) => {
    setOpenComments((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
    if (!accessToken) return;
    if (commentsByTask[taskId]) return;
    setCommentsLoading((prev) => ({ ...prev, [taskId]: true }));
    setCommentsError((prev) => ({ ...prev, [taskId]: null }));
    try {
      const data = await listTaskComments(accessToken, taskId);
      setCommentsByTask((prev) => ({ ...prev, [taskId]: data }));
    } catch (err) {
      setCommentsError((prev) => ({ ...prev, [taskId]: (err as Error).message }));
    } finally {
      setCommentsLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const handleAddComment = async (taskId: string) => {
    if (!accessToken) return;
    const text = (commentInputs[taskId] ?? "").trim();
    if (!text) return;
    setCommentsSaving((prev) => ({ ...prev, [taskId]: true }));
    setCommentsError((prev) => ({ ...prev, [taskId]: null }));
    try {
      const created = await addTaskComment(accessToken, taskId, text);
      setCommentsByTask((prev) => {
        const list = prev[taskId] ?? [];
        return { ...prev, [taskId]: [...list, created] };
      });
      setCommentInputs((prev) => ({ ...prev, [taskId]: "" }));
    } catch (err) {
      setCommentsError((prev) => ({ ...prev, [taskId]: (err as Error).message }));
    } finally {
      setCommentsSaving((prev) => ({ ...prev, [taskId]: false }));
    }
  };

  const renderTaskItem = (task: Task, depth = 0): JSX.Element => {
    const assignees = task.assignees ?? [];
    const completedCount = assignees.filter((a) => a.is_completed).length;
    const totalAssignees = assignees.length;
    const currentAssignment = currentUserId ? assignees.find((a) => a.user_id === currentUserId) : undefined;
    const isCanceled = task.status === "Canceled";
    const isDone = task.status === "Done";
    const canComplete =
      Boolean(currentAssignment) && !currentAssignment?.is_completed && !isDone && !isCanceled && !savingTask;
    const youCompleted = Boolean(currentAssignment?.is_completed);
    const taskDeadlineMs = new Date(task.deadline ?? task.planned_end).getTime();
    const projectDeadlineMs = projectDeadline ? new Date(projectDeadline).getTime() : Number.NaN;
    const isAfterProjectDeadline =
      Number.isFinite(taskDeadlineMs) && Number.isFinite(projectDeadlineMs) && taskDeadlineMs > projectDeadlineMs;

    return (
      <article
        key={task.id}
        className="project-card"
        style={{ borderColor: depth ? "#e5e7eb" : undefined, marginLeft: depth ? depth * 14 : 0 }}
      >
        <header className="table-header">
          <div className="stack" style={{ gap: "6px" }}>
            <div className="stack" style={{ gap: "4px" }}>
              <h4 style={{ margin: 0 }}>{task.title}</h4>
              <p className="muted" style={{ margin: 0 }}>
                {task.description}
              </p>
            </div>
            {depth > 0 && <span className="tag subtask-tag">Подзадача</span>}
          </div>
          <div className="table-actions">
            <span className="tag">{task.status}</span>
            {isAfterProjectDeadline && <span className="tag warning">Дедлайн задачи позже дедлайна проекта</span>}
            {youCompleted && <span className="tag success">Вы завершили эту задачу</span>}
            {canComplete && (
              <button className="primary-btn" type="button" onClick={() => onCompleteTask(task)} disabled={savingTask}>
                Завершить
              </button>
            )}
            {isDone && (
              <button className="ghost-btn" type="button" onClick={() => onReopenTask(task)} disabled={savingTask}>
                Отменить выполнение
              </button>
            )}
            <button className="ghost-btn" type="button" onClick={() => onEditTask(task)}>
              Редактировать
            </button>
            <button className="ghost-btn" type="button" onClick={() => onCreateSubtask(task)}>
              Создать подзадачу
            </button>
            <button className="ghost-btn" type="button" onClick={() => onRequestReview(task)} disabled={!hasMembers}>
              Запросить ревью
            </button>
            <button className="ghost-btn" type="button" onClick={() => void toggleComments(task.id)}>
              {openComments[task.id] ? "Скрыть комментарии" : "Комментарии"}
            </button>
            <button className="danger-btn" type="button" onClick={() => onDeleteTask(task.id)} disabled={savingTask}>
              Удалить
            </button>
          </div>
        </header>
          <div className="project-meta">
            <span>
              {new Date(task.planned_start).toLocaleDateString("ru-RU")} -{" "}
              {new Date(task.deadline ?? task.planned_end).toLocaleDateString("ru-RU")}
            </span>
            <span>Правило завершения: {task.completion_rule}</span>
            <span>Выполнено: {totalAssignees ? `${completedCount}/${totalAssignees}` : "исполнители не назначены"}</span>
            {currentAssignment ? (
              <span>Ваш статус: {currentAssignment.is_completed ? "отмечено" : "надо отметить"}</span>
            ) : (
              <span>Вы не исполнитель задачи</span>
            )}
            {task.outcome.result && <span>Фактический результат: {task.outcome.result}</span>}
            {task.reviews?.length ? (
            <div className="stack" style={{ gap: "4px" }}>
              <strong>Ревью</strong>
              {task.reviews.map((r) => (
                <span key={r.id} className="muted">
                  {r.status}
                  {r.comment ? ` (${r.comment})` : ""}
                  {r.com_reviewer ? ` · Комментарий ревьюера: ${r.com_reviewer}` : ""}
                </span>
              ))}
            </div>
          ) : (
              <span>Ревью пока нет</span>
            )}
          </div>
        {openComments[task.id] && (
          <div className="stack" style={{ gap: "8px", marginTop: "8px" }}>
            <div className="table-header" style={{ padding: 0 }}>
              <strong>Комментарии</strong>
              <span className="muted">{commentsByTask[task.id]?.length ?? 0} шт.</span>
            </div>
            {commentsError[task.id] && <p className="form-error">{commentsError[task.id]}</p>}
            {commentsLoading[task.id] ? (
              <p className="muted" style={{ margin: 0 }}>
                Загружаем комментарии...
              </p>
            ) : commentsByTask[task.id]?.length ? (
              <div className="stack" style={{ gap: "6px" }}>
                {commentsByTask[task.id]!.map((c) => (
                  <div key={c.id} className="project-meta" style={{ padding: "6px 0" }}>
                    <p style={{ margin: 0 }}>{c.text}</p>
                    <span className="muted">
                      Автор: {c.author_email || "не указан"}
                    </span>
                    <span className="muted">{new Date(c.created_at).toLocaleString("ru-RU")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Комментариев пока нет.
              </p>
            )}
            <div className="stack" style={{ gap: "6px" }}>
              <textarea
                className="input"
                rows={2}
                placeholder="Оставьте комментарий..."
                value={commentInputs[task.id] ?? ""}
                onChange={(event) => setCommentInputs((prev) => ({ ...prev, [task.id]: event.target.value }))}
              />
              <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                <button
                  className="primary-btn"
                  type="button"
                  disabled={commentsSaving[task.id] || !accessToken}
                  onClick={() => void handleAddComment(task.id)}
                >
                  {commentsSaving[task.id] ? "Сохраняем..." : "Добавить"}
                </button>
              </div>
            </div>
          </div>
        )}
        {childrenMap.get(task.id)?.length ? (
          <div className="stack" style={{ gap: "8px" }}>
            {childrenMap.get(task.id)!.map((child) => renderTaskItem(child, depth + 1))}
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <section className="card">
      <div className="table-header">
        <div>
          <h3>Задачи</h3>
          <p className="muted">План и исполнение</p>
        </div>
        <div className="stack" style={{ alignItems: "flex-end" }}>
          {loadingTasks && <span className="tag">Загрузка...</span>}
          <button
            className="ghost-btn"
            type="button"
            onClick={onRecalculate}
            disabled={recalculating || loadingTasks || savingTask}
          >
            {recalculating ? "Пересчитываем..." : "Пересчитать план"}
          </button>
          <button className="primary-btn" type="button" onClick={onCreateTask}>
            Создать задачу
          </button>
        </div>
      </div>
      {loadingTasks ? (
        <p>Загружаем задачи...</p>
      ) : tasks.length === 0 ? (
        <p className="muted">Задач пока нет.</p>
      ) : (
        <div className="stack" style={{ gap: "12px" }}>
          {tasks
            .filter((task) => !task.parent_id)
            .map((task) => renderTaskItem(task))}
        </div>
      )}
    </section>
  );
};

export default TasksSection;
