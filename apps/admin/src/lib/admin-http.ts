const DEFAULT_BACKEND_API_BASE_URL = "";

type AdminQueryValue = boolean | null | number | string | undefined;
type AdminQuery = object;

type AdminRequestOptions = Omit<RequestInit, "body" | "credentials"> & {
  body?: BodyInit;
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
  return resolveBackendApiBaseUrl(
    import.meta.env.VITE_BACKEND_API_BASE_URL ?? DEFAULT_BACKEND_API_BASE_URL,
    typeof window === "undefined" ? undefined : window.location.hostname,
  );
}

function resolveBackendApiBaseUrl(configuredBaseUrl: string, hostname?: string) {
  if (!configuredBaseUrl || (hostname && isLocalHostname(hostname))) {
    return "";
  }

  return configuredBaseUrl.replace(/\/$/, "");
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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
  const { body: requestBody, emptyResponse = false, json, ...init } = options;
  const headers = new Headers(init.headers);

  if (requestBody !== undefined && json !== undefined) {
    throw new TypeError("Admin API requests cannot include both body and json.");
  }

  headers.set("accept", "application/json");

  const body = json === undefined ? requestBody : JSON.stringify(json);

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
    const nestedError =
      record.error && typeof record.error === "object" && !Array.isArray(record.error)
        ? (record.error as Record<string, unknown>)
        : null;
    const errorRecord = nestedError ?? record;

    return {
      code: typeof errorRecord.code === "string" ? errorRecord.code : undefined,
      details: errorRecord.details,
      message: normalizeAdminApiErrorMessage(errorRecord.message),
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
  resolveBackendApiBaseUrl,
  withAdminQuery,
};
export type { AdminQuery, AdminQueryValue, AdminRequestOptions };
