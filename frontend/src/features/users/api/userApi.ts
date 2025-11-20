import { apiRequest } from "../../../shared/api/client";

export type UserSummary = {
  id: string;
  email: string;
  full_name?: string | null;
};

export const searchUsers = (token: string, search: string, limit = 10) => {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  params.set("limit", String(limit));
  return apiRequest<UserSummary[]>(`/users?${params.toString()}`, { token });
};
