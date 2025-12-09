import { Link } from "react-router-dom";

const ProjectPageHeader = () => (
  <div className="table-header">
    <div>
      <h2>Проект</h2>
      <p className="muted">Статус, команда и задачи</p>
    </div>
    <Link className="ghost-btn" to="/">
      На главную
    </Link>
  </div>
);

export default ProjectPageHeader;
