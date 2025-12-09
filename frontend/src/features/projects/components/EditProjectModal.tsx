import ProjectForm, { type ProjectFormValues } from "./ProjectForm";
import type { Project } from "../api/projectApi";

type EditProjectModalProps = {
  open: boolean;
  project: Project | null;
  loading: boolean;
  onSubmit: (values: ProjectFormValues) => void;
  onClose: () => void;
};

const EditProjectModal = ({ open, project, loading, onSubmit, onClose }: EditProjectModalProps) => {
  if (!open || !project) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ minWidth: "640px" }}>
        <div className="table-header">
          <div>
            <h3>Редактировать проект</h3>
            <p className="muted">Измените данные, описание и критерии успеха</p>
          </div>
          <button className="ghost-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <ProjectForm mode="edit" initialProject={project} onSubmit={onSubmit} onCancel={onClose} loading={loading} />
      </div>
    </div>
  );
};

export default EditProjectModal;
