// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdminLoginUrl } from "./admin-api";

describe("admin login URL", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays on the admin origin when no API origin is configured", () => {
    vi.stubEnv("VITE_BACKEND_API_BASE_URL", "");

    const loginUrl = new URL(getAdminLoginUrl("/site"));

    expect(loginUrl.origin).toBe(window.location.origin);
    expect(loginUrl.pathname).toBe("/api/auth/github/start");
    expect(loginUrl.searchParams.get("target")).toBe("admin");
    expect(loginUrl.searchParams.get("returnTo")).toBe("/site");
  });
});
