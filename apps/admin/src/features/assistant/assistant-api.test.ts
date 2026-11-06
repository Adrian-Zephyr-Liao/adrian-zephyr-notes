import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decideAssistantAction } from "./assistant-api";

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

describe("assistant API boundary", () => {
  it("sends no replaceable target payload on action confirmation", async () => {
    await decideAssistantAction("conversation-1", "action-1", "CONFIRM");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/assistant/conversations/conversation-1/actions/action-1/decision",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ decision: "CONFIRM" }),
        credentials: "include",
      }),
    );
  });
});
