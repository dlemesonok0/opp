const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export type ApiRequestOptions = RequestInit & { token?: string };

const CYRILLIC_RE = /[А-Яа-яЁё]/;

const DIRECT_TRANSLATIONS: Record<string, string> = {
  "Team not found": "Команда не найдена",
  "Project not found": "Проект не найден",
  "Task not found": "Задача не найдена",
  "Review not found": "Ревью не найдено",
  "User not found": "Пользователь не найден",
  "Not allowed": "Недостаточно прав",
  "Invite not found": "Приглашение не найдено",
  "Invite already processed": "Приглашение уже обработано",
  "Invite already sent to this email": "Приглашение уже отправлено на этот email",
  "User is already a member of this team": "Пользователь уже состоит в этой команде",
  "User is not a member of this team": "Пользователь не состоит в этой команде",
  "You cannot accept an invite not addressed to you":
    "Вы не можете принять приглашение, адресованное не вам",
  "You cannot decline an invite not addressed to you":
    "Вы не можете отклонить приглашение, адресованное не вам",
  "Invalid refresh token": "Недействительный refresh token",
  "Not a refresh token": "Это не refresh token",
  "Refresh token revoked": "Refresh token отозван",
  "No jti in token": "В токене отсутствует jti",
  "Reviewer already assigned to this project": "Ревьюер уже назначен на этот проект",
  "Reviewer already assigned to this task": "Ревьюер уже назначен на эту задачу",
  "You are not assigned to this task": "Вы не назначены на эту задачу",
  "Task assignees require the project to have a team":
    "Для назначения исполнителей проект должен иметь команду",
  "Project team has no members to assign": "В команде проекта нет участников для назначения",
  "Membership must belong to the project team": "Участие должно относиться к команде проекта",
  "Assignee must be an existing user or the project team":
    "Исполнитель должен быть существующим пользователем или командой проекта",
  "Assignee must be a member of the project team":
    "Исполнитель должен быть участником команды проекта",
  "Subtask must start after parent starts":
    "Подзадача должна начинаться после начала родительской задачи",
  "Subtask must finish before parent ends":
    "Подзадача должна завершаться до окончания родительской задачи",
  "Subtask must start before parent ends":
    "Подзадача должна начинаться до окончания родительской задачи",
  "parentId must refer to a task within the same project":
    "parentId должен ссылаться на задачу в том же проекте",
  "dependency predecessor must be in the same project":
    "Предшественник зависимости должен быть в том же проекте",
  "plannedEnd must be >= plannedStart": "Дата окончания должна быть не раньше даты начала",
  "Project has no team; only team members can view it":
    "У проекта нет команды; просматривать могут только участники команды",
  "Project has no team; only team members can edit it":
    "У проекта нет команды; редактировать могут только участники команды",
  "Project has no team; only team members can delete it":
    "У проекта нет команды; удалять могут только участники команды",
};

const ACTION_TRANSLATIONS: Record<string, string> = {
  create: "создавать",
  view: "просматривать",
  edit: "редактировать",
  delete: "удалять",
  "invite users": "приглашать пользователей",
  "view invites": "просматривать приглашения",
  "revoke invites": "отзывать приглашения",
};

const REGEX_TRANSLATIONS: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
  [
    /^You are not allowed to (.+) this project$/i,
    (match) => {
      const action = ACTION_TRANSLATIONS[match[1].trim()] || "выполнять это действие";
      return `Нет прав, чтобы ${action} этот проект`;
    },
  ],
  [
    /^You are not allowed to (.+) for this team$/i,
    (match) => {
      const action = ACTION_TRANSLATIONS[match[1].trim()] || "выполнять это действие";
      return `Нет прав, чтобы ${action} для этой команды`;
    },
  ],
  [/^value is not a valid email address/i, () => "Некорректный email адрес"],
  [/^value is not a valid uuid/i, () => "Некорректный идентификатор"],
  [/^field required$/i, () => "Поле обязательно"],
  [
    /^string should have at least (\d+) character/i,
    (match) => `Минимум ${match[1]} символов`,
  ],
  [
    /^string should have at most (\d+) character/i,
    (match) => `Максимум ${match[1]} символов`,
  ],
  [/^string should have at least (\d+) characters$/i, (match) => `Минимум ${match[1]} символов`],
  [/^string should have at most (\d+) characters$/i, (match) => `Максимум ${match[1]} символов`],
  [
    /^ensure this value has at least (\d+) characters?$/i,
    (match) => `Минимум ${match[1]} символов`,
  ],
  [
    /^ensure this value has at most (\d+) characters?$/i,
    (match) => `Максимум ${match[1]} символов`,
  ],
  [
    /^ensure this value is greater than or equal to (.+)$/i,
    (match) => `Значение должно быть не меньше ${match[1]}`,
  ],
  [
    /^ensure this value is less than or equal to (.+)$/i,
    (match) => `Значение должно быть не больше ${match[1]}`,
  ],
  [/^input should be a valid datetime$/i, () => "Некорректная дата и время"],
  [/^input should be a valid date$/i, () => "Некорректная дата"],
  [/^input should be a valid boolean$/i, () => "Некорректное логическое значение"],
  [/^input should be a valid integer$/i, () => "Некорректное число"],
  [/^value is not a valid integer$/i, () => "Некорректное число"],
  [/^input should be a valid number$/i, () => "Некорректное число"],
  [/^value is not a valid number$/i, () => "Некорректное число"],
  [/^string does not match regex/i, () => "Неверный формат"],
  [/^request failed with status (\d+)$/i, (match) => `Ошибка запроса: статус ${match[1]}`],
];

function localizeErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Произошла ошибка. Попробуйте еще раз.";
  }
  if (CYRILLIC_RE.test(trimmed)) {
    return trimmed;
  }
  const direct = DIRECT_TRANSLATIONS[trimmed];
  if (direct) {
    return direct;
  }
  for (const [pattern, formatter] of REGEX_TRANSLATIONS) {
    const match = trimmed.match(pattern);
    if (match) {
      return formatter(match);
    }
  }
  return "Произошла ошибка. Попробуйте еще раз.";
}

export async function extractErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();
  const fallback = `Ошибка запроса: статус ${response.status}`;

  if (!rawText) {
    return fallback;
  }

  const maybeJson = contentType.includes("application/json") || rawText.trim().startsWith("{");
  if (maybeJson) {
    try {
      const data = JSON.parse(rawText) as {
        detail?: string | Array<{ msg?: string }>;
        message?: string;
        error?: string;
        errors?: Array<{ message?: string } | string>;
      };

      if (typeof data.detail === "string" && data.detail.trim()) {
        return localizeErrorMessage(data.detail);
      }
      if (Array.isArray(data.detail)) {
        const joined = data.detail
          .map((item) => (typeof item === "string" ? item : item?.msg))
          .filter((msg): msg is string => Boolean(msg && msg.trim()))
          .map((msg) => localizeErrorMessage(msg))
          .join("; ");
        if (joined) {
          return joined;
        }
      }
      if (typeof data.message === "string" && data.message.trim()) {
        return localizeErrorMessage(data.message);
      }
      if (typeof data.error === "string" && data.error.trim()) {
        return localizeErrorMessage(data.error);
      }
      if (Array.isArray(data.errors)) {
        const joined = data.errors
          .map((item) => (typeof item === "string" ? item : item?.message))
          .filter((msg): msg is string => Boolean(msg && msg.trim()))
          .map((msg) => localizeErrorMessage(msg))
          .join("; ");
        if (joined) {
          return joined;
        }
      }
    } catch {
      // Fall back to raw text below.
    }
  }

  return localizeErrorMessage(rawText || fallback);
}

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
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export { API_URL };
