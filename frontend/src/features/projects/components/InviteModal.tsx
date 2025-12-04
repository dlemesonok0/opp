import { type FormEvent } from "react";

type InviteModalProps = {
  open: boolean;
  inviteEmail: string;
  inviteStatus: string | null;
  invitesError: string | null;
  loadingInvites: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onEmailChange: (value: string) => void;
};

const InviteModal = ({
  open,
  inviteEmail,
  inviteStatus,
  invitesError,
  loadingInvites,
  onClose,
  onSubmit,
  onEmailChange,
}: InviteModalProps) => {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal" style={{ minWidth: "480px" }}>
        <div className="table-header">
          <div>
            <h3>Приглашение в команду</h3>
            <p className="muted">Email того, кого хотите пригласить</p>
          </div>
          <button className="ghost-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <form className="form" onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              className="input"
              value={inviteEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="form-actions">
            <button className="ghost-btn" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="primary-btn" type="submit" disabled={loadingInvites}>
              {loadingInvites ? "Отправляем..." : "Отправить"}
            </button>
          </div>
          {inviteStatus && <p className="muted">{inviteStatus}</p>}
          {invitesError && <p className="form-error">{invitesError}</p>}
        </form>
      </div>
    </div>
  );
};

export default InviteModal;
