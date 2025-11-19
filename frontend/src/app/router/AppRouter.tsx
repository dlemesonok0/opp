import { BrowserRouter, Route, Routes } from "react-router-dom";
import PrivateRoute from "../../shared/components/PrivateRoute";
import LoginPage from "../../features/auth/pages/LoginPage";
import RegisterPage from "../../features/auth/pages/RegisterPage";
import MainLayout from "../layout/MainLayout";
import DashboardPage from "../pages/DashboardPage";
import CoursesPage from "../../features/courses/pages/CoursesPage";
import ProjectsPage from "../../features/projects/pages/ProjectsPage";

const AppRouter = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<PrivateRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="projects" element={<ProjectsPage />} />
        </Route>
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRouter;
