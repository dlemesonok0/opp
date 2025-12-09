import { type FormEvent } from "react";

type ProjectReviewerModalProps = {
  open: boolean;
  projectTitle: string;
  email: string;
  comment: string;
  reviewerError: string | null;
  reviewerMessage: string | null;
  savingReviewer: boolean;
  hasMembers: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onEmailChange: (value: string) => void;
  onCommentChange: (value: string) => void;
};

const ProjectReviewerModal = ({
  open,
  projectTitle,
  email,
  comment,
  reviewerError,
  reviewerMessage,
  savingReviewer,
  hasMembers,
  onClose,
  onSubmit,
  onEmailChange,
  onCommentChange,
}: ProjectReviewerModalProps) => {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ minWidth: "480px" }}>
        <div className="table-header">
          <div>
            <h3>Запросить ревьюера для проекта</h3>
            <p className="muted">{projectTitle}</p>
          </div>
          <button className="ghost-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="project-reviewer">Email ревьюера</label>
            <input
              id="project-reviewer"
              type="email"
              className="input"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="reviewer@example.com"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="project-reviewer-comment">Комментарий (необязательно)</label>
            <textarea
              id="project-reviewer-comment"
              className="input"
              rows={2}
              value={comment}
              onChange={(e) => onCommentChange(e.target.value)}
            />
          </div>
          {reviewerError && <p className="form-error">{reviewerError}</p>}
          {reviewerMessage && <p className="muted">{reviewerMessage}</p>}
          <div className="form-actions">
            <button className="ghost-btn" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="primary-btn" type="submit" disabled={savingReviewer || !hasMembers}>
              {savingReviewer ? "Отправляем..." : "Пригласить ревьюера"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectReviewerModal;
