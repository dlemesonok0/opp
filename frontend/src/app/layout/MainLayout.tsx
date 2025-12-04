import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

const MainLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="content" style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar__left">
          <Link to="/" className="topbar__brand">
            Opp
          </Link>
          <nav className="topbar__nav">
            <Link to="/">Projects</Link>
            <Link to="/reviews">My reviews</Link>
          </nav>
          <div className="topbar__text">
            <strong>Панель управления</strong>
            <span>Проекты, задачи и команда в одном месте</span>
          </div>
        </div>
        <div className="topbar__right">
          {user?.email && <span className="topbar__user">{user.email}</span>}
          <button className="ghost-btn" onClick={logout}>
            Выйти
          </button>
        </div>
      </header>

      <main className="page-content" style={{ paddingTop: "12px" }}>
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
