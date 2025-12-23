import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";

const RegisterForm: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const validatePassword = (value: string): string | null => {
    if (value.length < 8) {
      return "Пароль должен быть не короче 8 символов";
    }
    const hasLetter = /[A-Za-zА-Яа-яЁё]/.test(value);
    const hasDigit = /\d/.test(value);
    if (!hasLetter || !hasDigit) {
      return "Пароль должен содержать буквы и цифры";
    }
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const passwordError = validatePassword(password);
    if (passwordError) {
      setErr(passwordError);
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      navigate("/");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form className="form" onSubmit={onSubmit}>
        <h2>Регистрация</h2>
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
            placeholder="минимум 8 символов"
          />
        </div>
        {err && <p className="form-error">{err}</p>}
        <button className="primary-btn" type="submit" disabled={loading}>
          {loading ? "Создаём..." : "Создать аккаунт"}
        </button>
      </form>
      <p className="muted">
        Уже есть аккаунт? <Link to="/login">Войти</Link>
      </p>
    </>
  );
};

export default RegisterForm;
