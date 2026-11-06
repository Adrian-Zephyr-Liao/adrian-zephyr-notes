import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decideOAuthAuthorization, getOAuthConsent } from "./oauth-api";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("VITE_BACKEND_API_BASE_URL", "");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OAuth consent API boundary", () => {
  it("looks up only the entered user code with the browser session", async () => {
    await getOAuthConsent("ABCD-EFGH");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/oauth/consent?user_code=ABCD-EFGH",
      expect.objectContaining({
        credentials: "include",
        cache: "no-store",
        referrerPolicy: "no-referrer",
      }),
    );
  });

  it.each(["allow", "deny"] as const)(
    "sends a bound %s decision without a replaceable identity",
    async (decision) => {
      await decideOAuthAuthorization({ user_code: "ABCD-EFGH", decision });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/oauth/authorize",
        expect.objectContaining({
          body: JSON.stringify({ user_code: "ABCD-EFGH", decision }),
          method: "POST",
          credentials: "include",
          referrerPolicy: "strict-origin",
        }),
      );
    },
  );
});
