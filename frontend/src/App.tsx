import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginForm from "./components/LoginForm";
import PrivateRoute from "./components/PrivateRoute";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div style={{ padding: 16 }}>
      <h1>Личный кабинет</h1>
      <p>Вы вошли как: {user?.email}</p>
      <pre>{JSON.stringify(user, null, 2)}</pre>
      <button onClick={logout}>Выйти</button>
    </div>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginForm />} />
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
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
