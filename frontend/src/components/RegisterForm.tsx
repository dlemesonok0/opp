import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";

const RegisterForm: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await register(email, password);
      navigate("/");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 320 }}>
      <h2>Регистрация</h2>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        type="email"
        required
        style={{ display: "block", marginBottom: 8, width: "100%" }}
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        type="password"
        required
        style={{ display: "block", marginBottom: 8, width: "100%" }}
      />
      <button type="submit">Создать аккаунт</button>
      {err && <p style={{ color: "red" }}>{err}</p>}
    </form>
  );
};

export default RegisterForm;
