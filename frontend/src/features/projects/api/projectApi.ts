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
  course_id: string | null;
  team_id: string | null;
  outcome: ProjectOutcome;
};

export type ProjectMembership = Project & {
  course_title?: string | null;
  team_name?: string | null;
};

export type ProjectCreatePayload = {
  title: string;
  description: string;
  courseId?: string | null;
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
  courseId?: string | null;
  teamId?: string | null;
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
