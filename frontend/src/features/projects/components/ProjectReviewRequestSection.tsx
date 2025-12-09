type ProjectReviewRequestSectionProps = {
  projectHasTeam: boolean;
  savingReviewer: boolean;
  onOpenModal: () => void;
};

const ProjectReviewRequestSection = ({
  projectHasTeam,
  savingReviewer,
  onOpenModal,
}: ProjectReviewRequestSectionProps) => {
  if (!projectHasTeam) return null;

  return (
    <section className="card">
      <div className="table-header">
        <div>
          <h3>Ревью проекта</h3>
          <p className="muted">Запросите ревьюеров проекта по email</p>
        </div>
        <button className="primary-btn" type="button" onClick={onOpenModal} disabled={savingReviewer}>
          Пригласить ревьюера
        </button>
      </div>
    </section>
  );
};

export default ProjectReviewRequestSection;
