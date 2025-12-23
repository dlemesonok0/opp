import TaskForm, { type TaskFormValues } from "../../tasks/components/TaskForm";
import type { Task } from "../../tasks/api/taskApi";
import type { TeamMember } from "../../teams/api/teamApi";

type TaskModalProps = {
  open: boolean;
  tasks: Task[];
  loading: boolean;
  initialTask: Task | null;
  parentTask?: Task | null;
  assignees: { id: string; type: "team" | "user"; name: string; email?: string }[];
  members: TeamMember[];
  onClose: () => void;
  onSubmit: (values: TaskFormValues) => void;
  errorMessage?: string | null;
};

const TaskModal = ({
  open,
  tasks,
  loading,
  initialTask,
  parentTask,
  assignees,
  members,
  onClose,
  onSubmit,
  errorMessage = null,
}: TaskModalProps) => {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ minWidth: "640px" }}>
        <div className="table-header">
          <div>
            <h3>{initialTask ? "Редактировать задачу" : "Новая задача"}</h3>
            <p className="muted">Заполните данные задачи</p>
          </div>
          <button className="ghost-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <TaskForm
          tasks={tasks}
          loading={loading}
          onSubmit={onSubmit}
          initialTask={initialTask}
          mode={initialTask ? "edit" : "create"}
          parentTask={parentTask}
          assignees={assignees}
          members={members}
          externalError={errorMessage}
        />
      </div>
    </div>
  );
};

export default TaskModal;
