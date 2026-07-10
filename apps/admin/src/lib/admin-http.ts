const DEFAULT_BACKEND_API_BASE_URL = "";

type AdminQueryValue = boolean | null | number | string | undefined;
type AdminQuery = object;

type AdminRequestOptions = Omit<RequestInit, "body" | "credentials"> & {
  emptyResponse?: boolean;
  json?: unknown;
};

class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

function getBackendApiBaseUrl() {
  return (import.meta.env.VITE_BACKEND_API_BASE_URL ?? DEFAULT_BACKEND_API_BASE_URL).replace(
    /\/$/,
    "",
  );
}

function buildAdminQueryString(query: AdminQuery) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (isSerializableQueryValue(value)) {
      searchParams.set(key, String(value));
    }
  }

  return searchParams.toString();
}

function withAdminQuery(path: string, query: AdminQuery) {
  const queryString = buildAdminQueryString(query);

  return queryString ? `${path}?${queryString}` : path;
}

function isSerializableQueryValue(
  value: unknown,
): value is Exclude<AdminQueryValue, null | undefined> {
  return value !== undefined && value !== null && value !== "" && value !== "ALL";
}

async function requestAdminApi<TResponse>(
  path: string,
  options: AdminRequestOptions = {},
): Promise<TResponse> {
  const { emptyResponse = false, json, ...init } = options;
  const headers = new Headers(init.headers);

  headers.set("accept", "application/json");

  const body = json === undefined ? undefined : JSON.stringify(json);

  if (json !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${getBackendApiBaseUrl()}${path}`, {
    ...init,
    body,
    credentials: "include",
    headers,
  });

  if (!response.ok) {
    const errorPayload = await parseAdminApiErrorPayload(response);
    const message =
      typeof errorPayload.message === "string" && errorPayload.message.trim().length > 0
        ? errorPayload.message
        : `Admin API request failed: ${response.status}`;

    throw new AdminApiError(message, response.status, errorPayload.code, errorPayload.details);
  }

  if (emptyResponse || response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

async function parseAdminApiErrorPayload(response: Response) {
  const fallback = {
    code: undefined,
    details: undefined,
    message: undefined,
  };
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("application/json")) {
    return fallback;
  }

  try {
    const payload = (await response.json()) as unknown;

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return fallback;
    }

    const record = payload as Record<string, unknown>;

    return {
      code: typeof record.code === "string" ? record.code : undefined,
      details: record.details,
      message: normalizeAdminApiErrorMessage(record.message),
    };
  } catch {
    return fallback;
  }
}

function normalizeAdminApiErrorMessage(message: unknown) {
  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message.filter((item): item is string => typeof item === "string").join("；");
  }

  return undefined;
}

export {
  AdminApiError,
  buildAdminQueryString,
  getBackendApiBaseUrl,
  requestAdminApi,
  withAdminQuery,
};
export type { AdminQuery, AdminQueryValue, AdminRequestOptions };
