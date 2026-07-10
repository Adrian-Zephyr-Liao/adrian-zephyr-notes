import { describe, expect, it } from "vitest";
import { toAdminAgentRun } from "./prisma-admin-agent.mapper";

describe("toAdminAgentRun", () => {
  it("keeps site configuration review run types from persistence", () => {
    expect(
      toAdminAgentRun(
        createRunRecord({
          type: "SITE_CONFIG_REVIEW",
        }),
      ).type,
    ).toBe("SITE_CONFIG_REVIEW");
  });

  it("keeps planned workflow names and run types from persistence", () => {
    expect(
      toAdminAgentRun(
        createRunRecord({
          type: "MULTI_TASK_ORCHESTRATION",
          workflowName: "MULTI_TASK_ORCHESTRATION",
        }),
      ),
    ).toMatchObject({
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
  });

  it("maps persisted workflow output for resumed multi-task aggregation", () => {
    expect(
      toAdminAgentRun(
        createRunRecord({
          output: {
            findingCount: 2,
            workflow: "comment_moderation",
          },
        }),
      ).output,
    ).toEqual({
      findingCount: 2,
      workflow: "comment_moderation",
    });
  });

  it("rejects unsupported persisted workflow names instead of falling back", () => {
    expect(() =>
      toAdminAgentRun(
        createRunRecord({
          workflowName: "legacy",
        }),
      ),
    ).toThrow("Unsupported admin agent workflow name: legacy");
  });
});

function createRunRecord(
  overrides: Partial<Parameters<typeof toAdminAgentRun>[0]> = {},
): Parameters<typeof toAdminAgentRun>[0] {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-04T03:00:00.000Z"),
    currentNode: "complete",
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    interruption: null,
    input: {},
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: "user-1",
    status: "COMPLETED",
    summary: "已完成。",
    threadId: "run-1",
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T03:01:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}
