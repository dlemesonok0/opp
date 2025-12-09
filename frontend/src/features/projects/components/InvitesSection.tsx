import type { TeamInvite } from "../../teams/api/inviteApi";

type InvitesSectionProps = {
  invites: TeamInvite[];
  loadingInvites: boolean;
  invitesError: string | null;
  onOpenModal: () => void;
  onRevoke: (id: string) => void;
};

const InvitesSection = ({ invites, loadingInvites, invitesError, onOpenModal, onRevoke }: InvitesSectionProps) => (
  <section className="card">
    <div className="table-header">
      <div>
        <h3>Приглашения в команду</h3>
        <p className="muted">Отправьте приглашение по email</p>
      </div>
      <div className="stack" style={{ alignItems: "flex-end" }}>
        {loadingInvites && <span className="tag">Загрузка...</span>}
        <button className="primary-btn" type="button" onClick={onOpenModal}>
          Пригласить
        </button>
      </div>
    </div>
    {invitesError && <p className="form-error">{invitesError}</p>}
    {invites.length > 0 && (
      <div className="stack" style={{ marginTop: "1rem" }}>
        {invites.map((invite) => (
          <div key={invite.id} className="project-card">
            <div className="table-header">
              <div>
                <strong>{invite.invited_email}</strong>
                <p className="muted">{new Date(invite.created_at).toLocaleString("ru-RU")}</p>
              </div>
              <div className="stack" style={{ alignItems: "flex-end" }}>
                <span className="tag">{invite.status}</span>
                {invite.status === "Pending" && (
                  <button className="ghost-btn" type="button" onClick={() => onRevoke(invite.id)}>
                    Отозвать
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default InvitesSection;
