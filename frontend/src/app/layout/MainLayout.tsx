import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const MainLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">ТОП НАЗВАНИЕ</div>
        <nav className="sidebar__nav">
          <NavLink to="/" end>
            Дашборд
          </NavLink>
          <NavLink to="/courses">Предметы</NavLink>
          <NavLink to="/projects">Проекты</NavLink>
        </nav>
        <div className="sidebar__footer">
          <p className="sidebar__user">{user?.email}</p>
          <button className="ghost-btn" onClick={logout}>
            Выйти
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="page-header">
          <h1>Портфель проектов</h1>
          <p>Управляйте учебными предметами и командами из одного места</p>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
