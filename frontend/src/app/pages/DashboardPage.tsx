import { Link } from "react-router-dom";

const DashboardPage = () => {
  return (
    <div className="grid">
      <section className="card">
        <h2>Что дальше?</h2>
        <p>
          Создайте новый предмет, чтобы описать контекст курса. После этого
          можно собирать проекты, задачи и команды.
        </p>
        <Link className="primary-btn" to="/courses">
          Перейти к предметам
        </Link>
      </section>
      <section className="card">
        <h2>Проекты</h2>
        <p>
          Для каждого проекта зафиксируйте ожидаемый результат и срок сдачи,
          чтобы студенты точно понимали критерии успеха.
        </p>
        <Link className="primary-btn" to="/projects">
          Управлять проектами
        </Link>
      </section>
      <section className="card">
        <h2>Поддержка процессов</h2>
        <ul className="checklist">
          <li>Прозрачные статусы задач</li>
          <li>Связь проектов и учебных предметов</li>
          <li>Единая навигация для координаторов</li>
        </ul>
      </section>
    </div>
  );
};

export default DashboardPage;
