import { request, requestResponse } from "./http.ts";

class ApiClient {
  readonly server: string;
  readonly #token: string;

  constructor(server: string, token: string) {
    this.server = server;
    this.#token = token;
  }

  #init(init: RequestInit): RequestInit {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.#token}`);
    return { ...init, headers };
  }

  json<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
    return request<T>(this.server, path, this.#init(init));
  }

  send<T = unknown>(path: string, method: string, body?: unknown): Promise<T> {
    return this.json<T>(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
  }

  response(path: string, init: RequestInit = {}): Promise<Response> {
    return requestResponse(this.server, path, this.#init(init));
  }
}

export { ApiClient };
