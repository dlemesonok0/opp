import { apiRequest } from "../../../shared/api/client";

export type Task = {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  status: string;
  duration: number;
  planned_start: string;
  planned_end: string;
  actual_start: string | null;
  actual_end: string | null;
  is_milestone: boolean;
  completion_rule: string;
};

export type TaskCreatePayload = {
  title: string;
  description: string;
  duration: number;
  plannedStart: string;
  plannedEnd: string;
  isMilestone: boolean;
  completionRule: "AnyOne" | "AllAssignees";
  parentId?: string | null;
  outcome: {
    description: string;
    acceptanceCriteria: string;
    deadline: string;
  };
};

export const listProjectTasks = (token: string, projectId: string) =>
  apiRequest<Task[]>(`/projects/${projectId}/tasks`, { token });

export const createTask = (token: string, projectId: string, payload: TaskCreatePayload) =>
  apiRequest<Task>(`/projects/${projectId}/tasks`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
