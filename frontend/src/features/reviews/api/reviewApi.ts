import { apiRequest } from "../../../shared/api/client";

export type ReviewStatus = "Pending" | "Accepted" | "Rejected";

export type TaskSummary = {
  id: string;
  title: string;
  project_id: string;
  project_title?: string | null;
};

export type ProjectSummary = {
  id: string;
  title: string;
  team_id: string | null;
};

export type TaskReview = {
  id: string;
  task_id: string;
  reviewer_id: string;
  status: ReviewStatus;
  comment?: string | null;
  created_at: string;
  task: TaskSummary;
};

export type ProjectReview = {
  id: string;
  project_id: string;
  reviewer_id: string;
  status: ReviewStatus;
  comment?: string | null;
  created_at: string;
  project: ProjectSummary;
};

export type ReviewUpdatePayload = {
  status: ReviewStatus;
  comment?: string | null;
};

export const listTaskReviews = (token: string, status?: ReviewStatus) =>
  apiRequest<TaskReview[]>(`/reviews/tasks${status ? `?status_filter=${status}` : ""}`, { token });

export const listProjectReviews = (token: string, status?: ReviewStatus) =>
  apiRequest<ProjectReview[]>(`/reviews/projects${status ? `?status_filter=${status}` : ""}`, { token });

export const updateTaskReview = (token: string, reviewId: string, payload: ReviewUpdatePayload) =>
  apiRequest<TaskReview>(`/reviews/tasks/${reviewId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

export const updateProjectReview = (token: string, reviewId: string, payload: ReviewUpdatePayload) =>
  apiRequest<ProjectReview>(`/reviews/projects/${reviewId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
