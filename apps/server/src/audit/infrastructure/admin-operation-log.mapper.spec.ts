import { describe, expect, it } from "vitest";
import type { AdminOperationLog } from "../domain/admin-operation-log";
import {
  sanitizeAdminOperationLogMetadata,
  toAdminOperationLogResponse,
} from "./admin-operation-log.mapper";

describe("toAdminOperationLogResponse", () => {
  it("keeps audit responses business-facing by removing internal orchestration metadata", () => {
    expect(
      toAdminOperationLogResponse(
        createOperationLog({
          metadata: {
            agentFindingId: "finding-1",
            checkpointId: "checkpoint-1",
            decision: "EXECUTE_PROPOSED_ACTION",
            execution: {
              checkpointNamespace: "admin-agent",
              debugUrl: "/agent/runs/thread-1",
              result: "done",
              run_id: "run-1",
              thread_id: "thread-1",
              workflowName: "COMMENT_MODERATION_ANALYSIS",
            },
            lang_graph_run_id: "langgraph-run-1",
            runtimeDebugUrl: "/agent/runs/thread-1",
            source: "admin_agent",
            targetIds: [
              "comment-1",
              "LangGraph checkpoint threadId workflowName",
              { node: "approval", value: "comment-2" },
            ],
            workflowRevision: "v1",
          },
        }),
      ).metadata,
    ).toEqual({
      agentFindingId: "finding-1",
      decision: "EXECUTE_PROPOSED_ACTION",
      source: "admin_agent",
      targetIds: ["comment-1"],
    });
  });

  it("only publishes product audit metadata fields", () => {
    expect(
      toAdminOperationLogResponse(
        createOperationLog({
          metadata: {
            action: "branch",
            agentFindingId: "finding-1",
            articleSlug: "hello-world",
            diagnostic: { result: "debug-only" },
            findingCount: 2,
            source: "admin_agent",
            taskTitle: "评论治理分析",
            userVisibleButUnsupported: "should-not-leak",
          },
        }),
      ).metadata,
    ).toEqual({
      action: "branch",
      agentFindingId: "finding-1",
      articleSlug: "hello-world",
      findingCount: 2,
      source: "admin_agent",
      taskTitle: "评论治理分析",
    });
  });

  it("does not expose internal orchestration summaries", () => {
    expect(
      toAdminOperationLogResponse(
        createOperationLog({
          summary: "Opened LangGraph 运行面板 for checkpoint threadId workflowName.",
        }),
      ).summary,
    ).toBe("Recorded an admin operation.");

    expect(
      toAdminOperationLogResponse(
        createOperationLog({
          summary: "Opened /agent/runs/thread-1 runtime debug view.",
        }),
      ).summary,
    ).toBe("Recorded an admin operation.");
  });
});

describe("sanitizeAdminOperationLogMetadata", () => {
  it("returns null when metadata only contains internal orchestration fields", () => {
    expect(
      sanitizeAdminOperationLogMetadata({
        checkpointId: "checkpoint-1",
        currentNode: "approval",
        rawLangGraphState: { node: "approval" },
        threadId: "thread-1",
        workflowRunId: "workflow-run-1",
      }),
    ).toBeNull();
  });
});

function createOperationLog(overrides: Partial<AdminOperationLog> = {}): AdminOperationLog {
  return {
    action: "ADMIN_AGENT_FINDING_DECIDED",
    actorLogin: "Adrian-Zephyr-Liao",
    actorUserId: "admin-1",
    createdAt: new Date("2026-07-09T08:00:00.000Z"),
    id: "log-1",
    ipAddress: "::1",
    metadata: null,
    resourceId: "comment-1",
    resourceType: "article_comment",
    summary: "Approved admin agent finding.",
    userAgent: "curl/8.0.0",
    ...overrides,
  };
}
