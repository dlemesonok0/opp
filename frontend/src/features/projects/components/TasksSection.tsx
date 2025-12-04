import type { Task } from "../../tasks/api/taskApi";

type TasksSectionProps = {
  tasks: Task[];
  loadingTasks: boolean;
  savingTask: boolean;
  childrenMap: Map<string, Task[]>;
  hasMembers: boolean;
  currentUserId: string | null;
  onCreateTask: () => void;
  onEditTask: (task: Task) => void;
  onCreateSubtask: (parent: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onRequestReview: (task: Task) => void;
  onCompleteTask: (task: Task) => void;
  onRecalculate: () => void;
  recalculating: boolean;
};

const TasksSection = ({
  tasks,
  loadingTasks,
  savingTask,
  childrenMap,
  hasMembers,
  currentUserId,
  onCreateTask,
  onEditTask,
  onCreateSubtask,
  onDeleteTask,
  onRequestReview,
  onCompleteTask,
  onRecalculate,
  recalculating,
}: TasksSectionProps) => {
  const renderTaskItem = (task: Task, depth = 0): JSX.Element => {
    const assignees = task.assignees ?? [];
    const completedCount = assignees.filter((a) => a.is_completed).length;
    const totalAssignees = assignees.length;
    const currentAssignment = currentUserId ? assignees.find((a) => a.user_id === currentUserId) : undefined;
    const canComplete =
      Boolean(currentAssignment) && !currentAssignment?.is_completed && task.status !== "Done" && !savingTask;
    const youCompleted = Boolean(currentAssignment?.is_completed);

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
            {youCompleted && <span className="tag success">Вы отметили выполнение</span>}
            {canComplete && (
              <button className="primary-btn" type="button" onClick={() => onCompleteTask(task)} disabled={savingTask}>
                Выполнить
              </button>
            )}
            <button className="ghost-btn" type="button" onClick={() => onEditTask(task)}>
              Редактировать
            </button>
            <button className="ghost-btn" type="button" onClick={() => onCreateSubtask(task)}>
              Создать подзадачу
            </button>
            <button className="ghost-btn" type="button" onClick={() => onRequestReview(task)} disabled={!hasMembers}>
              Запросить ревьюера
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
        </div>
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
