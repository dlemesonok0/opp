import type { Project } from "../api/projectApi";
import type { TeamMember } from "../../teams/api/teamApi";

type TeamSectionProps = {
  project: Project | null;
  members: TeamMember[];
  loadingMembers: boolean;
  membersError: string | null;
  isMember: boolean;
  leaving: boolean;
  userId?: string;
  onLeave: () => void;
};

const TeamSection = ({
  project,
  members,
  loadingMembers,
  membersError,
  isMember,
  leaving,
  userId,
  onLeave,
}: TeamSectionProps) => {
  if (!project?.team_id) return null;

  return (
    <section className="card">
      <div className="table-header">
        <div>
          <h3>Команда</h3>
          <p className="muted">Участники проекта</p>
        </div>
        {isMember && (
          <button className="danger-btn" onClick={onLeave} disabled={leaving}>
            {leaving ? "Выходим..." : "Выйти из команды"}
          </button>
        )}
      </div>
      {membersError && <p className="form-error">{membersError}</p>}
      {loadingMembers ? (
        <p>Загружаем участников...</p>
      ) : members.length === 0 ? (
        <p className="muted">Пока нет участников.</p>
      ) : (
        <div className="stack">
          {members.map((member) => (
            <div key={member.id} className="project-card">
              <div className="table-header">
                <div>
                  <strong>{member.full_name || member.email}</strong>
                  <p className="muted">{member.email}</p>
                </div>
                {isMember && userId === member.id && <span className="tag">Вы</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default TeamSection;
