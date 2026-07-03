const DEFAULT_BACKEND_API_BASE_URL = "http://localhost:3001";

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
    throw new AdminApiError(`Admin API request failed: ${response.status}`, response.status);
  }

  if (emptyResponse || response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export {
  AdminApiError,
  buildAdminQueryString,
  getBackendApiBaseUrl,
  requestAdminApi,
  withAdminQuery,
};
export type { AdminQuery, AdminQueryValue, AdminRequestOptions };
