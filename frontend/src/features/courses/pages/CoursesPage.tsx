import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import CourseForm from "../components/CourseForm";
import {
  createCourse,
  deleteCourse,
  listCourses,
  updateCourse,
} from "../api/courseApi";
import type { Course, CoursePayload } from "../api/courseApi";

const CoursesPage = () => {
  const { accessToken } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!accessToken) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listCourses(accessToken);
      setCourses(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  const handleSubmit = async (payload: CoursePayload) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      if (editingCourse) {
        await updateCourse(accessToken, editingCourse.id, payload);
        setEditingCourse(null);
      } else {
        await createCourse(accessToken, payload);
      }
      await fetchCourses();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    try {
      await deleteCourse(accessToken, id);
      if (editingCourse?.id === id) {
        setEditingCourse(null);
      }
      await fetchCourses();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid">
      <section className="card">
        <CourseForm
          initialCourse={editingCourse}
          onSubmit={handleSubmit}
          onCancel={() => setEditingCourse(null)}
          loading={saving}
        />
      </section>
      <section className="card">
        <div className="table-header">
          <div>
            <h3>Предметы</h3>
            <p className="muted">Данные подтягиваются из API FastAPI</p>
          </div>
          {saving && <span className="tag">Сохраняем...</span>}
        </div>
        {error && <p className="form-error">{error}</p>}
        {loading ? (
          <p>Загружаем список...</p>
        ) : courses.length === 0 ? (
          <p>Предметы не найдены</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th style={{ width: 200 }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr key={course.id}>
                  <td>{course.title}</td>
                  <td>
                    <div className="table-actions">
                      <button className="ghost-btn" onClick={() => setEditingCourse(course)}>
                        Редактировать
                      </button>
                      <button className="danger-btn" onClick={() => handleDelete(course.id)}>
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default CoursesPage;
