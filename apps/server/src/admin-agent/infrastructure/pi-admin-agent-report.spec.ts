import { Logger } from "@nestjs/common";
import type { ConversationId, TaskId } from "@earendil-works/pi-durable";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reportPiAdminAgentError } from "./pi-admin-agent-report";

describe("Pi runtime failure reporting", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records task identity without exposing the reported error or its payload", () => {
    const log = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const secret = "provider-key-and-private-comment";

    reportPiAdminAgentError({
      kind: "task_faulted",
      task: { id: 7 as TaskId, kind: "az.workflow", conversationId: 3 as ConversationId },
      reason: "threw",
      extension: "az-workflows",
      error: { message: secret, request: { authorization: secret } },
    });

    expect(log).toHaveBeenCalledWith({
      message: "Pi runtime reported a failure",
      kind: "task_faulted",
      taskId: 7,
      taskKind: "az.workflow",
      conversationId: 3,
      reason: "threw",
      extension: "az-workflows",
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });

  it("records failures outside tasks and their available host context", () => {
    const log = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

    reportPiAdminAgentError({ kind: "storage_failed", error: new Error("private database path") });
    reportPiAdminAgentError({ kind: "host_error", callback: "models", error: "private response" });
    reportPiAdminAgentError({
      kind: "extension_error",
      extension: "az.admin-business",
      conversationId: 4 as ConversationId,
      error: new Error("private arguments"),
    });

    expect(log.mock.calls).toEqual([
      [{ message: "Pi runtime reported a failure", kind: "storage_failed" }],
      [{ message: "Pi runtime reported a failure", kind: "host_error", callback: "models" }],
      [
        {
          message: "Pi runtime reported a failure",
          kind: "extension_error",
          extension: "az.admin-business",
          conversationId: 4,
        },
      ],
    ]);
  });
});
