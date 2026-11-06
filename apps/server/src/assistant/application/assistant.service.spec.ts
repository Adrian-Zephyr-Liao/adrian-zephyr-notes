import { describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import type { AssistantRepository, AssistantTurn } from "../domain/assistant.repository";
import type { AssistantRunner, AssistantRunnerInput } from "./assistant-runner.port";
import { AssistantService } from "./assistant.service";

describe("Assistant request lifecycle", () => {
  it("persists interruption if the HTTP event consumer exits before running the model", async () => {
    const fixture = setup();
    for await (const _event of await fixture.service.start(fixture.input)) break;
    expect(fixture.turn.status).toBe("INTERRUPTED");
    expect(fixture.runner.stream).not.toHaveBeenCalled();
  });

  it("settles cancellation when Stop wins the failure-finalization CAS", async () => {
    const fixture = setup();
    fixture.runner.stream.mockImplementation(async function* () {
      yield* [];
      throw new Error("upstream failed");
    });
    fixture.repo.finishTurn.mockImplementation(async () => {
      fixture.turn.status = "CANCELLING";
      return structuredClone(fixture.turn);
    });
    const events = await collect(await fixture.service.start(fixture.input));
    expect(events.at(-1)).toMatchObject({ type: "runError", code: "RUN_CANCELLED" });
    expect(fixture.turn.status).toBe("CANCELLED");
  });
  it("does not start the model when Stop wins before admission returns", async () => {
    const fixture = setup();
    let release!: () => void;
    fixture.repo.admitTurn.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { created: true, turn: structuredClone(fixture.turn) };
    });
    const pending = fixture.service.start(fixture.input);
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    expect(
      (
        await fixture.service.stop(
          fixture.actor,
          fixture.turn.conversationId,
          fixture.turn.requestId,
        )
      ).status,
    ).toBe("CANCELLED");
    release();
    const events = await collect(await pending);
    expect(events.at(-1)).toMatchObject({ type: "runError", code: "RUN_CANCELLED" });
    expect(fixture.runner.stream).not.toHaveBeenCalled();
  });

  it("lets Stop resolve an orphaned request after result persistence fails", async () => {
    const fixture = setup();
    fixture.repo.finishTurn.mockRejectedValue(new Error("database unavailable"));
    const events = await collect(await fixture.service.start(fixture.input));
    expect(events.at(-1)).toMatchObject({ type: "runError", code: "RESULT_SAVE_FAILED" });
    expect(fixture.turn.status).toBe("RUNNING");
    expect(
      (
        await fixture.service.stop(
          fixture.actor,
          fixture.turn.conversationId,
          fixture.turn.requestId,
        )
      ).status,
    ).toBe("CANCELLED");
  });

  it("does not overwrite a completed receipt with a late Stop", async () => {
    const fixture = setup();
    expect((await collect(await fixture.service.start(fixture.input))).at(-1)).toMatchObject({
      type: "runFinished",
    });
    expect(
      (
        await fixture.service.stop(
          fixture.actor,
          fixture.turn.conversationId,
          fixture.turn.requestId,
        )
      ).status,
    ).toBe("COMPLETED");
    expect(fixture.repo.finishCancellation).not.toHaveBeenCalled();
  });

  it("replays failed request identities without invoking the model again", async () => {
    const fixture = setup();
    fixture.turn.status = "FAILED";
    fixture.turn.errorCode = "MODEL_CALL_LIMIT";
    fixture.repo.admitTurn.mockResolvedValue({
      created: false,
      turn: structuredClone(fixture.turn),
    });
    expect((await collect(await fixture.service.start(fixture.input))).at(-1)).toMatchObject({
      type: "runError",
      code: "MODEL_CALL_LIMIT",
    });
    expect(fixture.runner.stream).not.toHaveBeenCalled();
  });

  it("passes opaque history and current action decisions to the runtime without changing stored records", async () => {
    const fixture = setup();
    const actionId = randomUUID();
    const pending = { kind: "comment_action", ok: true, data: { id: actionId, status: "PENDING" } };
    const original = {
      role: "toolResult",
      toolCallId: "call_1",
      toolName: "prepare_comment_moderation",
      content: [{ type: "text", text: JSON.stringify(pending) }],
      details: pending,
    };
    const previous = {
      ...fixture.turn,
      id: randomUUID(),
      status: "COMPLETED",
      transcript: { version: 1, messages: [original] },
    };
    fixture.repo.listTurns.mockResolvedValue({ turns: [previous, fixture.turn], nextBefore: null });
    fixture.repo.listCommentActions.mockResolvedValue([
      { id: actionId, status: "APPLIED", receipt: { auditLogId: "audit-receipt" } },
    ]);
    await collect(await fixture.service.start(fixture.input));
    const runtimeInput = fixture.runner.stream.mock.calls[0]![0];
    expect(runtimeInput.transcripts).toEqual([previous.transcript]);
    expect(JSON.stringify(runtimeInput.actions)).toContain('"status":"APPLIED"');
    expect(JSON.stringify(runtimeInput.actions)).toContain("audit-receipt");
    expect(original.details.data.status).toBe("PENDING");
  });
});

function setup() {
  const actor = { id: randomUUID(), login: "assistant-test" };
  const turn: AssistantTurn = {
    id: randomUUID(),
    conversationId: randomUUID(),
    requestId: randomUUID(),
    inputHash: "hash",
    input: "查看审计日志",
    status: "RUNNING",
    transcript: { version: 1, messages: [] },
    errorCode: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const repo = {
    admitTurn: vi.fn().mockResolvedValue({ created: true, turn }),
    getTurn: vi.fn(async () => structuredClone(turn)),
    listTurns: vi.fn().mockResolvedValue({ turns: [], nextBefore: null }),
    listCommentActions: vi.fn().mockResolvedValue([]),
    saveProgress: vi.fn(async () => structuredClone(turn)),
    finishTurn: vi.fn(async (input) => {
      if (turn.status === "RUNNING") turn.status = input.status;
      return structuredClone(turn);
    }),
    requestCancellation: vi.fn(async () => {
      if (turn.status === "RUNNING") turn.status = "CANCELLING";
      return structuredClone(turn);
    }),
    finishCancellation: vi.fn(async () => {
      if (turn.status === "CANCELLING") turn.status = "CANCELLED";
      return structuredClone(turn);
    }),
  };
  const runner = {
    isConfigured: () => true,
    capabilities: vi.fn(() => []),
    project: vi.fn(() => ({ messages: [], toolResults: [] })),
    stream: vi.fn(async function* (_input: AssistantRunnerInput) {
      yield { type: "finished" as const, status: "SUCCEEDED" as const, messages: [] };
    }),
  };
  const service = new AssistantService(
    repo as unknown as AssistantRepository,
    runner as AssistantRunner,
    new ConfigService({ ASSISTANT_ENABLED: "true" }),
  );
  const input = {
    actor,
    conversationId: turn.conversationId,
    requestId: turn.requestId,
    message: turn.input,
    signal: new AbortController().signal,
    authorize: async () => {},
  };
  return { service, repo, runner, turn, actor, input };
}
async function collect<T>(items: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const item of items) values.push(item);
  return values;
}
