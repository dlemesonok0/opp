import { apiRequest } from "../../../shared/api/client";

export type TeamInvite = {
  id: string;
  team_id: string;
  invited_email: string;
  status: string;
  created_at: string;
  team_name?: string | null;
};

export const listTeamInvites = (token: string, teamId: string) =>
  apiRequest<TeamInvite[]>(`/teams/${teamId}/invites`, { token });

export const createTeamInvite = (token: string, teamId: string, email: string) =>
  apiRequest<TeamInvite>(`/teams/${teamId}/invites`, {
    method: "POST",
    token,
    body: JSON.stringify({ email }),
  });

export const listMyInvites = (token: string) =>
  apiRequest<TeamInvite[]>(`/users/me/invites`, { token });

export const acceptInvite = (token: string, inviteId: string) =>
  apiRequest<TeamInvite>(`/invites/${inviteId}/accept`, {
    method: "POST",
    token,
  });

export const declineInvite = (token: string, inviteId: string) =>
  apiRequest<TeamInvite>(`/invites/${inviteId}/decline`, {
    method: "POST",
    token,
  });

export const revokeInvite = (token: string, inviteId: string) =>
  apiRequest<void>(`/invites/${inviteId}`, {
    method: "DELETE",
    token,
  });
