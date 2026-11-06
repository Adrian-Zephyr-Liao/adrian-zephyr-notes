// @vitest-environment jsdom

import type {
  AssistantConversationResponse,
  AssistantHistoryResponse,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantStreamInput, AssistantStreamResult } from "./assistant-stream";
import { useAssistantConversation } from "./use-assistant-conversation";

const api = vi.hoisted(() => ({
  createAssistantConversation: vi.fn<() => Promise<AssistantConversationResponse>>(),
  getAssistantHistory: vi.fn<(id: string) => Promise<AssistantHistoryResponse>>(),
  getAssistantTurn: vi.fn<() => Promise<AssistantTurnResponse>>(),
  stopAssistantTurn: vi.fn<() => Promise<AssistantTurnResponse>>(),
}));
const transport = vi.hoisted(() => ({
  streamAssistantTurn:
    vi.fn<
      (input: AssistantStreamInput) => { abort(): void; finished: Promise<AssistantStreamResult> }
    >(),
}));
vi.mock("./assistant-api", () => api);
vi.mock("./assistant-stream", () => transport);

beforeEach(() => {
  vi.resetAllMocks();
  api.getAssistantHistory.mockImplementation((id) => Promise.resolve(history(id)));
});
afterEach(cleanup);

describe("conversation navigation races", () => {
  it.each(["resolve", "reject"] as const)(
    "ignores a late conversation creation %s after navigating away",
    async (outcome) => {
      const created = deferred<AssistantConversationResponse>();
      api.createAssistantConversation.mockReturnValue(created.promise);
      const navigate = vi.fn();
      const { result, rerender } = renderHook(({ id }) => useAssistantConversation(id, navigate), {
        initialProps: { id: undefined as string | undefined },
      });
      let submitted!: Promise<void>;
      act(() => {
        submitted = result.current.send("查看审计日志", "request-a");
      });
      rerender({ id: "conversation-b" });
      await waitFor(() => expect(result.current.history?.conversation.id).toBe("conversation-b"));
      await act(async () => {
        if (outcome === "resolve") created.resolve(conversation("conversation-a"));
        else created.reject(new Error("late network error"));
        await submitted;
      });
      expect(navigate).not.toHaveBeenCalled();
      expect(result.current.history?.conversation.id).toBe("conversation-b");
      expect(result.current.error).toBeNull();
      expect(result.current.retry).toBeNull();
      expect(result.current.busy).toBe(false);
      expect(transport.streamAssistantTurn).not.toHaveBeenCalled();
    },
  );

  it.each(["resolve", "reject"] as const)(
    "ignores a late stop %s after leaving and revisiting the same conversation",
    async (outcome) => {
      let loads = 0;
      api.getAssistantHistory.mockImplementation((id) =>
        Promise.resolve(
          history(id, id === "conversation-a" && ++loads === 1 ? [turn("old", "RUNNING")] : []),
        ),
      );
      const stopped = deferred<AssistantTurnResponse>();
      const stream = deferred<AssistantStreamResult>();
      const abort = vi.fn();
      api.stopAssistantTurn.mockReturnValue(stopped.promise);
      api.getAssistantTurn.mockResolvedValue(turn("new"));
      transport.streamAssistantTurn.mockImplementation((input) => {
        input.onStarted?.();
        return { abort, finished: stream.promise };
      });
      const { result, rerender } = renderHook(({ id }) => useAssistantConversation(id, vi.fn()), {
        initialProps: { id: "conversation-a" },
      });
      await waitFor(() => expect(result.current.activeRequestId).toBe("old"));
      let stop!: Promise<void>;
      act(() => {
        stop = result.current.stop();
      });
      rerender({ id: "conversation-b" });
      await waitFor(() => expect(result.current.history?.conversation.id).toBe("conversation-b"));
      rerender({ id: "conversation-a" });
      await waitFor(() => expect(result.current.history?.conversation.id).toBe("conversation-a"));
      let submitted!: Promise<void>;
      act(() => {
        submitted = result.current.send("查看审计日志", "new");
      });
      await waitFor(() => expect(result.current.activeRequestId).toBe("new"));
      try {
        await act(async () => {
          if (outcome === "resolve") stopped.resolve(turn("old", "CANCELLED"));
          else stopped.reject(new Error("late stop error"));
          await stop;
        });
        expect(abort).not.toHaveBeenCalled();
        expect(result.current.activeRequestId).toBe("new");
        expect(result.current.error).toBeNull();
        expect(result.current.history?.turns).toEqual([]);
      } finally {
        await act(async () => {
          stream.resolve({ terminal: "finished" });
          await submitted;
        });
      }
    },
  );

  it("does not let an old refresh replace newer history after revisiting a conversation", async () => {
    const refreshed = deferred<AssistantHistoryResponse>();
    const { result, rerender } = renderHook(({ id }) => useAssistantConversation(id, vi.fn()), {
      initialProps: { id: "conversation-a" },
    });
    await waitFor(() => expect(result.current.history?.conversation.id).toBe("conversation-a"));
    api.getAssistantHistory.mockReturnValueOnce(refreshed.promise);
    let refresh!: Promise<void>;
    act(() => {
      refresh = result.current.refresh();
    });
    rerender({ id: "conversation-b" });
    await waitFor(() => expect(result.current.history?.conversation.id).toBe("conversation-b"));
    api.getAssistantHistory.mockResolvedValueOnce(history("conversation-a", [turn("new")]));
    rerender({ id: "conversation-a" });
    await waitFor(() => expect(result.current.history?.turns[0]?.requestId).toBe("new"));
    await act(async () => {
      refreshed.resolve(history("conversation-a", [turn("old")]));
      await refresh;
    });
    expect(result.current.history?.turns.map((item) => item.requestId)).toEqual(["new"]);
  });

  it.each(["resolve", "cancelling", "reject"] as const)(
    "keeps a new request stoppable while an older Stop %s arrives on the same page",
    async (outcome) => {
      const oldStream = deferred<AssistantStreamResult>();
      const newStream = deferred<AssistantStreamResult>();
      const oldStop = deferred<AssistantTurnResponse>();
      const newStop = deferred<AssistantTurnResponse>();
      const abortNew = vi.fn();
      for (const [finished, abort] of [
        [oldStream, vi.fn()],
        [newStream, abortNew],
      ] as const) {
        transport.streamAssistantTurn.mockImplementationOnce((input) => {
          input.onStarted?.();
          return { abort, finished: finished.promise };
        });
      }
      api.getAssistantTurn
        .mockResolvedValueOnce(turn("old"))
        .mockResolvedValueOnce(turn("new", "CANCELLED"));
      api.stopAssistantTurn
        .mockReturnValueOnce(oldStop.promise)
        .mockReturnValueOnce(newStop.promise);
      const { result } = renderHook(() => useAssistantConversation("conversation-a", vi.fn()));
      await waitFor(() => expect(result.current.loading).toBe(false));
      let oldSubmitted!: Promise<void>;
      let oldStopped!: Promise<void>;
      act(() => {
        oldSubmitted = result.current.send("查看审计日志", "old");
      });
      act(() => {
        oldStopped = result.current.stop();
      });
      await act(async () => {
        oldStream.resolve({ terminal: "finished" });
        await oldSubmitted;
      });
      let newSubmitted!: Promise<void>;
      let newStopped!: Promise<void>;
      act(() => {
        newSubmitted = result.current.send("查看审计日志", "new");
      });
      try {
        expect(result.current.stopping).toBe(false);
        act(() => {
          newStopped = result.current.stop();
        });
        expect(api.stopAssistantTurn).toHaveBeenCalledTimes(2);
        await act(async () => {
          if (outcome === "reject") oldStop.reject(new Error("old stop connection failed"));
          else oldStop.resolve(turn("old", outcome === "cancelling" ? "CANCELLING" : "COMPLETED"));
          await oldStopped;
        });
        expect(abortNew).not.toHaveBeenCalled();
        expect(result.current.activeRequestId).toBe("new");
        expect(result.current.stopping).toBe(true);
        expect(result.current.error).toBeNull();
      } finally {
        await act(async () => {
          oldStop.resolve(turn("old"));
          newStop.resolve(turn("new", "CANCELLED"));
          newStream.resolve({ terminal: "error" });
          await Promise.all([oldStopped, newStopped, newSubmitted]);
        });
      }
      expect(result.current.busy).toBe(false);
      expect(result.current.history?.turns.find((item) => item.requestId === "old")?.status).toBe(
        "COMPLETED",
      );
    },
  );

  it.each(["CANCELLED", "CANCELLING"] as const)(
    "does not roll back %s when an earlier refresh arrives after Stop",
    async (status) => {
      api.getAssistantHistory.mockResolvedValueOnce(
        history("conversation-a", [turn("old", "RUNNING")]),
      );
      const { result } = renderHook(() => useAssistantConversation("conversation-a", vi.fn()));
      await waitFor(() => expect(result.current.activeRequestId).toBe("old"));
      const refreshed = deferred<AssistantHistoryResponse>();
      api.getAssistantHistory.mockReturnValueOnce(refreshed.promise);
      api.stopAssistantTurn.mockResolvedValue(turn("old", status));
      let refresh!: Promise<void>;
      act(() => {
        refresh = result.current.refresh();
      });
      await act(async () => {
        await result.current.stop();
      });
      expect(result.current.busy).toBe(status === "CANCELLING");
      await act(async () => {
        refreshed.resolve(history("conversation-a", [turn("old", "RUNNING")]));
        await refresh;
      });
      expect(result.current.history?.turns[0]?.status).toBe(status);
      expect(result.current.busy).toBe(status === "CANCELLING");
    },
  );
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
function conversation(id: string): AssistantConversationResponse {
  return { id, createdAt: "2026-11-06T00:00:00.000Z", updatedAt: "2026-11-06T00:00:00.000Z" };
}
function history(id: string, turns: AssistantTurnResponse[] = []): AssistantHistoryResponse {
  return { conversation: conversation(id), turns, nextBefore: null };
}
function turn(
  requestId: string,
  status: AssistantTurnResponse["status"] = "COMPLETED",
): AssistantTurnResponse {
  return {
    id: `turn-${requestId}`,
    conversationId: "conversation-a",
    requestId,
    input: "查看审计日志",
    status,
    messages: [],
    toolResults: [],
    actions: [],
    error: null,
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
  };
}
