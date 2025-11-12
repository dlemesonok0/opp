import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginForm from "./components/LoginForm";
import RegisterForm from "./components/RegisterForm";
import PrivateRoute from "./components/PrivateRoute";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: 16 }}>
      <h1>Личный кабинет</h1>
      <p>Вы вошли как: {user?.email}</p>
      <button onClick={logout}>Выйти</button>
    </div>
  );
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/login" element={<LoginForm />} />
    <Route path="/register" element={<RegisterForm />} />
    <Route
      path="/"
      element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      }
    />
  </Routes>
);

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <nav style={{ padding: 8, display: "flex", gap: 8 }}>
          <Link to="/">Главная</Link>
          <Link to="/login">Вход</Link>
          <Link to="/register">Регистрация</Link>
        </nav>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
