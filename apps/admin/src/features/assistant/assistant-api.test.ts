import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decideAssistantAction,
  getAssistantHistory,
  getAssistantTurn,
  stopAssistantTurn,
} from "./assistant-api";

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
  it("uses the public request identity for status and stop, with credentials", async () => {
    await getAssistantTurn("conversation-1", "request-1");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/assistant/conversations/conversation-1/turns/request-1",
      expect.objectContaining({ credentials: "include" }),
    );
    fetchMock.mockResolvedValueOnce(Response.json({}));
    await stopAssistantTurn("conversation-1", "request-1");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/assistant/conversations/conversation-1/turns/request-1/stop",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

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

  it("loads older history through the server cursor", async () => {
    await getAssistantHistory("conversation-1", "oldest-turn");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/assistant/conversations/conversation-1?before=oldest-turn",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
