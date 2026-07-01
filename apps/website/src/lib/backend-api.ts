const DEFAULT_BACKEND_API_BASE_URL = "http://localhost:3001";

function getBackendApiBaseUrl() {
  return (
    process.env.BACKEND_API_BASE_URL ??
    process.env.ARTICLE_API_BASE_URL ??
    DEFAULT_BACKEND_API_BASE_URL
  ).replace(/\/$/, "");
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

export { copySetCookieHeaders, getBackendApiBaseUrl, toProxyRedirectResponse };
