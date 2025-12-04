import { apiRequest } from "../../../shared/api/client";

export type ProjectOutcome = {
  id: string;
  description: string;
  acceptance_criteria: string;
  deadline: string;
};

export type Project = {
  id: string;
  title: string;
  description: string;
  team_id: string | null;
  outcome: ProjectOutcome;
};

export type ProjectReview = {
  id: string;
  project_id: string;
  reviewer_id: string;
  status: "Pending" | "Accepted" | "Rejected";
  comment?: string | null;
  created_at: string;
};

export type ProjectMembership = Project & {
  team_name?: string | null;
};

export type ProjectCreatePayload = {
  title: string;
  description: string;
  teamId?: string | null;
  outcome: {
    description: string;
    acceptanceCriteria: string;
    deadline: string;
  };
};

export type ProjectUpdatePayload = {
  title?: string;
  description?: string;
  teamId?: string | null;
  outcome?: {
    description?: string;
    acceptanceCriteria?: string;
    deadline?: string;
  };
};

export const listProjects = (token: string) =>
  apiRequest<Project[]>("/projects", { token });

export const createProject = (token: string, payload: ProjectCreatePayload) =>
  apiRequest<Project>("/projects", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export const listMyProjects = (token: string) =>
  apiRequest<ProjectMembership[]>("/users/me/projects", { token });

export const updateProject = (
  token: string,
  projectId: string,
  payload: ProjectUpdatePayload,
) =>
  apiRequest<Project>(`/projects/${projectId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

export const deleteProject = (token: string, projectId: string) =>
  apiRequest<void>(`/projects/${projectId}`, {
    method: "DELETE",
    token,
  });

export const getProject = (token: string, projectId: string) =>
  apiRequest<Project>(`/projects/${projectId}`, { token });

export const addProjectReviewer = (
  token: string,
  projectId: string,
  payload: { reviewerId?: string; reviewerEmail?: string; comment?: string | null },
) =>
  apiRequest<ProjectReview>(`/projects/${projectId}/reviews`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
