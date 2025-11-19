import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { Location } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";

type LocationState = { from?: Location } | null;

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectPath = (location.state as LocationState)?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(redirectPath, { replace: true });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form className="form" onSubmit={onSubmit}>
        <h2>Вход</h2>
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="name@university.ru"
          />
        </div>
        <div className="form-field">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            placeholder="••••••••"
          />
        </div>
        {err && <p className="form-error">{err}</p>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
      <p className="muted">
        Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
      </p>
    </>
  );
};

export default LoginForm;
