const DEFAULT_BACKEND_API_BASE_URL = "http://localhost:3001";

type BackendProxyRequest = {
  headers: Headers;
  nextUrl: {
    searchParams: URLSearchParams;
  };
};

type BackendProxyOptions = {
  body?: string;
  forwardClientHeaders?: boolean;
  method?: string;
  path: string;
  responseBody?: "empty" | "text";
};

function getBackendApiBaseUrl() {
  return (
    process.env.BACKEND_API_BASE_URL ??
    process.env.ARTICLE_API_BASE_URL ??
    DEFAULT_BACKEND_API_BASE_URL
  ).replace(/\/$/, "");
}

async function proxyBackendRequest(request: BackendProxyRequest, options: BackendProxyOptions) {
  const url = new URL(`${getBackendApiBaseUrl()}${normalizeProxyPath(options.path)}`);

  for (const [key, value] of request.nextUrl.searchParams) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: createProxyRequestHeaders(request, {
      forwardClientHeaders: options.forwardClientHeaders ?? false,
      hasBody: options.body !== undefined,
    }),
    body: options.body,
    cache: "no-store",
  });
  const headers = new Headers();

  if (options.responseBody !== "empty") {
    headers.set("content-type", response.headers.get("content-type") ?? "application/json");
  }

  copySetCookieHeaders(response, headers);

  return new Response(options.responseBody === "empty" ? null : await response.text(), {
    status: response.status,
    headers,
  });
}

function copySetCookieHeaders(from: Response, to: Headers) {
  const setCookies = getSetCookieHeaders(from.headers);

  for (const setCookie of setCookies) {
    to.append("set-cookie", setCookie);
  }
}

async function toProxyRedirectResponse(response: Response) {
  const headers = new Headers();
  const location = response.headers.get("location");

  copySetCookieHeaders(response, headers);

  if (!isRedirectStatus(response.status) || !location) {
    headers.set("content-type", response.headers.get("content-type") ?? "text/plain");
    return new Response(await response.text(), {
      status: response.status,
      headers,
    });
  }

  headers.set("location", location);

  return new Response(null, {
    status: response.status,
    headers,
  });
}

function getSetCookieHeaders(headers: Headers) {
  const headersWithSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = headersWithSetCookie.getSetCookie?.();

  if (setCookies && setCookies.length > 0) {
    return setCookies;
  }

  const setCookie = headers.get("set-cookie");
  return setCookie ? [setCookie] : [];
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

function createProxyRequestHeaders(
  request: BackendProxyRequest,
  options: {
    forwardClientHeaders: boolean;
    hasBody: boolean;
  },
) {
  const headers = new Headers({
    cookie: request.headers.get("cookie") ?? "",
  });

  if (options.hasBody) {
    headers.set("content-type", "application/json");
  }

  if (options.forwardClientHeaders) {
    headers.set("user-agent", request.headers.get("user-agent") ?? "");
    headers.set(
      "x-forwarded-for",
      request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        request.headers.get("cf-connecting-ip") ??
        "",
    );
  }

  return headers;
}

function normalizeProxyPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export { copySetCookieHeaders, getBackendApiBaseUrl, proxyBackendRequest, toProxyRedirectResponse };
