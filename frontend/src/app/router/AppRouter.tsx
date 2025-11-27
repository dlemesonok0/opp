import { BrowserRouter, Route, Routes } from "react-router-dom";
import PrivateRoute from "../../shared/components/PrivateRoute";
import LoginPage from "../../features/auth/pages/LoginPage";
import RegisterPage from "../../features/auth/pages/RegisterPage";
import MainLayout from "../layout/MainLayout";
import DashboardPage from "../pages/DashboardPage";
import ProjectDetailPage from "../../features/projects/pages/ProjectDetailPage";

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<PrivateRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="projects/:projectId" element={<ProjectDetailPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    );

export default AppRouter;
