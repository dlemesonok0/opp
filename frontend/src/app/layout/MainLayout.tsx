import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const MainLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">Opp</div>
        <nav className="sidebar__nav">
          <NavLink to="/" end>
            Дашборд
          </NavLink>
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
          <h1>Управление проектами</h1>
          <p>Ведите дорожные карты, задачи и команды без привязки к предметам.</p>
        </header>
        <div className="page-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
