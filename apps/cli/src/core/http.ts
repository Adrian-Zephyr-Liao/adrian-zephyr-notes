import { CliError, isRecord } from "./errors.ts";

function uncertainty(path: string, init: RequestInit): string {
  return path.startsWith("/api/admin/") && init.method && !["GET", "HEAD"].includes(init.method)
    ? "; the write outcome may be unknown. Check the resource before retrying"
    : "";
}

async function requestResponse(
  server: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith("/api/") || path.includes("#"))
    throw new CliError("INVALID_PATH", "Expected an API path");
  const uncertainWrite = uncertainty(path, init);
  let response: Response;
  const headers = new Headers(init.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  try {
    response = await fetch(`${server}${path}`, {
      ...init,
      redirect: "error",
      signal: init.signal ?? AbortSignal.timeout(30_000),
      headers,
    });
  } catch {
    throw new CliError("REQUEST_FAILED", `Cannot reach the API server${uncertainWrite}`);
  }
  if (response.ok) return response;
  const data: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = isRecord(data) && isRecord(data.error) ? data.error : data;
    const code =
      isRecord(data) && typeof data.error === "string"
        ? data.error
        : isRecord(error) && typeof error.code === "string"
          ? error.code
          : `HTTP_${response.status}`;
    const message =
      isRecord(error) && typeof error.message === "string"
        ? error.message
        : isRecord(data) && typeof data.error_description === "string"
          ? data.error_description
          : `API request failed (${response.status})`;
    throw new CliError(
      code,
      `${message}${response.status >= 500 ? uncertainWrite : ""}`,
      response.status,
    );
  }
  return response;
}

async function request<T>(
  server: string,
  path: string,
  init: RequestInit = {},
  emptyResponse = false,
): Promise<T> {
  const response = await requestResponse(server, path, init);
  const data: unknown =
    response.status === 204 || emptyResponse
      ? undefined
      : await response.json().catch(() => undefined);
  if (!emptyResponse && response.status !== 204 && data === undefined) {
    throw new CliError(
      "INVALID_RESPONSE",
      `API did not return complete JSON; check the server origin${uncertainty(path, init)}`,
    );
  }
  return data as T;
}

export { request, requestResponse };
