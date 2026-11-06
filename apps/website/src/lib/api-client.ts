type ApiErrorPayload = {
  error?: {
    code?: string;
    details?: unknown;
    message?: string;
  };
};

type RequestJsonOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | null;
  json?: unknown;
};

class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly payload: ApiErrorPayload | null,
  ) {
    super(payload?.error?.message ?? `Request failed: ${status}`);
  }
}

class ApiResponseError extends Error {
  constructor(readonly status: number) {
    super(`Invalid JSON response: ${status}`);
  }
}

async function requestJson<TResponse = void>(
  input: RequestInfo | URL,
  options: RequestJsonOptions = {},
): Promise<TResponse> {
  const { json, ...requestInit } = options;
  const headers = new Headers(requestInit.headers);
  const body = json === undefined ? requestInit.body : JSON.stringify(json);

  if (json !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(input, {
    ...requestInit,
    body,
    headers,
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new ApiRequestError(response.status, toApiErrorPayload(parseJsonPayload(responseText)));
  }

  if (response.status === 204 || response.status === 205) {
    return undefined as TResponse;
  }

  try {
    return JSON.parse(responseText) as TResponse;
  } catch {
    // A successful write may already have committed. Never repeat the request here.
    throw new ApiResponseError(response.status);
  }
}

function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function parseJsonPayload(responseText: string) {
  if (!responseText) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return undefined;
  }
}

function toApiErrorPayload(payload: unknown): ApiErrorPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  return payload as ApiErrorPayload;
}

export { ApiRequestError, ApiResponseError, isApiRequestError, requestJson };
export type { ApiErrorPayload, RequestJsonOptions };
