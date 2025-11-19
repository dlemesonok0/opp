import { apiRequest } from "../../../shared/api/client";

export type Course = {
  id: string;
  title: string;
};

export type CoursePayload = {
  title: string;
};

export const listCourses = (token: string) =>
  apiRequest<Course[]>("/courses", {
    token,
  });

export const createCourse = (token: string, payload: CoursePayload) =>
  apiRequest<Course>("/courses", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export const updateCourse = (
  token: string,
  courseId: string,
  payload: Partial<CoursePayload>,
) =>
  apiRequest<Course>(`/courses/${courseId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

export const deleteCourse = (token: string, courseId: string) =>
  apiRequest<void>(`/courses/${courseId}`, {
    method: "DELETE",
    token,
  });
