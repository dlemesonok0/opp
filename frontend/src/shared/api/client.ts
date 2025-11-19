const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export type ApiRequestOptions = RequestInit & { token?: string };

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}) {
  const { token, headers, body, ...rest } = options;
  const baseHeaders: Record<string, string> = {};
  if (body && !(body instanceof FormData)) {
    baseHeaders["Content-Type"] = "application/json";
  }
  if (token) {
    baseHeaders["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      ...baseHeaders,
      ...(headers as Record<string, string> | undefined),
    },
    body,
    ...rest,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Ошибка запроса ${response.status}`);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export { API_URL };
