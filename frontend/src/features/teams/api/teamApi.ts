import { apiRequest } from "../../../shared/api/client";

export type Team = {
  id: string;
  name: string;
  created_at: string;
};

export type TeamMember = {
  id: string;
  email: string;
  full_name?: string | null;
};

export const createTeam = (token: string, payload: { name: string }) =>
  apiRequest<Team>("/teams", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export const listTeamMembers = (token: string, teamId: string) =>
  apiRequest<TeamMember[]>(`/teams/${teamId}/members`, { token });

export const addTeamMember = (
  token: string,
  teamId: string,
  payload: { userId: string },
) =>
  apiRequest(`/teams/${teamId}/members`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });

export const deleteTeamMember = (token: string, teamId: string, userId: string) =>
  apiRequest<void>(`/teams/${teamId}/members/${userId}`, {
    method: "DELETE",
    token,
  });
