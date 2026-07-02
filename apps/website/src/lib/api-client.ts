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
  const payload = parseJsonPayload(responseText);

  if (!response.ok) {
    throw new ApiRequestError(response.status, toApiErrorPayload(payload));
  }

  return payload as TResponse;
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

export { ApiRequestError, isApiRequestError, requestJson };
export type { ApiErrorPayload, RequestJsonOptions };
