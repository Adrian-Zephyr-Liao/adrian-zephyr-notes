type CookieOptions = {
  domain?: string;
  httpOnly?: boolean;
  maxAgeSeconds?: number;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
};

const SESSION_COOKIE_NAME = "azn_session";

function serializeCookie(name: string, value: string, options: CookieOptions = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${options.maxAgeSeconds}`);
  }

  parts.push(`Path=${options.path ?? "/"}`);
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.httpOnly ?? true) {
    parts.push("HttpOnly");
  }

  if (options.secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function parseCookies(cookieHeader: string | undefined) {
  return Object.fromEntries(
    (cookieHeader ?? "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");

        if (separatorIndex < 0) {
          return [part, ""];
        }

        const key = part.slice(0, separatorIndex);
        const value = decodeURIComponent(part.slice(separatorIndex + 1));
        return [key, value];
      }),
  );
}

export { SESSION_COOKIE_NAME, parseCookies, serializeCookie };
