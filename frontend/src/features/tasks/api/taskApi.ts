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
  deadline: string | null;
  actual_start: string | null;
  actual_end: string | null;
  is_milestone: boolean;
  auto_scheduled: boolean;
  completion_rule: string;
  assignee_ids: string[];
  dependencies: TaskDependency[];
  outcome: {
    id: string;
    description: string;
    acceptance_criteria: string;
    deadline: string;
  };
};

export type TaskDependency = {
  id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  type: "FS" | "FF" | "SS" | "SF";
  lag: number;
};

export type Assignee = {
  id: string;
  type: "team" | "user";
  name: string;
  email?: string | null;
};

export type TaskCreatePayload = {
  title: string;
  description: string;
  duration: number;
  plannedStart: string;
  plannedEnd: string;
  deadline?: string | null;
  autoScheduled?: boolean;
  completionRule: "AnyOne" | "AllAssignees";
  parentId?: string | null;
  assigneeIds?: string[];
  dependencies?: Array<{
    predecessorId: string;
    type: TaskDependency["type"];
    lag?: number;
  }>;
  outcome: {
    description: string;
    acceptanceCriteria: string;
    deadline: string;
  };
};

export type TaskUpdatePayload = Partial<{
  title: string;
  description: string;
  duration: number;
  plannedStart: string;
  plannedEnd: string;
  deadline: string | null;
  autoScheduled: boolean;
  completionRule: "AnyOne" | "AllAssignees";
  parentId: string | null;
  assigneeIds: string[];
  dependencies: TaskCreatePayload["dependencies"];
}>;

export const listProjectTasks = (token: string, projectId: string) =>
  apiRequest<Task[]>(`/projects/${projectId}/tasks`, { token });

export const createTask = (token: string, projectId: string, payload: TaskCreatePayload) =>
  apiRequest<Task>(`/projects/${projectId}/tasks`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export const updateTask = (token: string, taskId: string, payload: TaskUpdatePayload) =>
  apiRequest<Task>(`/tasks/${taskId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });

export const deleteTask = (token: string, taskId: string) =>
  apiRequest<void>(`/tasks/${taskId}`, {
    method: "DELETE",
    token,
  });
