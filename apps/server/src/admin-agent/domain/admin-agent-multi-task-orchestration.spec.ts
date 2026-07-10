import { describe, expect, it } from "vitest";
import type { AdminAgentRun } from "./admin-agent-run.entity";
import {
  buildMultiTaskPlanMessages,
  buildMultiTaskSummary,
  createMultiTaskApprovalRequest,
  createMultiTaskChildFailureResult,
  createMultiTaskChildResultFromWorkflowResult,
  createMultiTaskCompletionResult,
  createMultiTaskOrchestrationOutput,
  normalizeMultiTaskPlan,
  parseMultiTaskPlanResponse,
  toMultiTaskChildDedupeKey,
  toMultiTaskChildResult,
  toMultiTaskPlanFromOutput,
  toWorkflowRunDedupeKey,
  type MultiTaskChildResult,
  type MultiTaskPlanItem,
} from "./admin-agent-multi-task-orchestration";

describe("admin agent multi-task orchestration", () => {
  it("builds an LLM planning prompt with only child business task options", () => {
    const messages = buildMultiTaskPlanMessages({
      requestedBy: "admin",
      scope: "comments-and-audit",
    });

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("system");
    expect(messages[0]?.content).toContain("Agent 业务处理");
    expect(messages[0]?.content).toContain("禁止选择 multi_task_orchestration");
    expect(messages[1]?.role).toBe("user");
    const promptPayload = JSON.parse(messages[1]?.content ?? "{}");

    expect(promptPayload.availableTasks.map((task: { taskName: string }) => task.taskName)).toEqual(
      ["comment_moderation_analysis", "article_assistance", "site_config_review", "audit_review"],
    );
    expect(promptPayload.availableTasks).not.toContainEqual(
      expect.objectContaining({ taskName: "multi_task_orchestration" }),
    );
    expect(promptPayload).toEqual(
      expect.objectContaining({
        requestedInput: {
          requestedBy: "admin",
          scope: "comments-and-audit",
        },
      }),
    );
  });

  it("normalizes explicit task names into child workflow plans", () => {
    expect(
      normalizeMultiTaskPlan({
        taskNames: ["comment_moderation_analysis", "site_config_review"],
      }),
    ).toEqual([
      {
        input: {},
        reason: "用户明确指定的 Agent 业务处理。",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
      {
        input: {},
        reason: "用户明确指定的 Agent 业务处理。",
        workflowName: "SITE_CONFIG_REVIEW",
      },
    ]);
  });

  it("filters unsupported child tasks and the multi-task workflow itself", () => {
    expect(
      normalizeMultiTaskPlan({
        tasks: [
          { taskName: "multi_task_orchestration" },
          { taskName: "unknown" },
          { input: { search: "comments" }, reason: "看操作记录", taskName: "audit_review" },
        ],
      }),
    ).toEqual([
      {
        input: { search: "comments" },
        reason: "看操作记录",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
  });

  it("parses LLM multi-task planning responses from surrounding text", () => {
    expect(
      parseMultiTaskPlanResponse(`
        Here is the plan:
        {
          "summary": "需要并行处理内容和审计。",
          "tasks": [
            {
              "taskName": "article_assistance",
              "reason": "检查草稿",
              "input": { "articleId": "article-1" }
            },
            {
              "taskName": "audit_review",
              "reason": "复核最近写操作"
            }
          ]
        }
      `),
    ).toEqual({
      plan: [
        {
          input: { articleId: "article-1" },
          reason: "检查草稿",
          workflowName: "ARTICLE_ASSISTANCE",
        },
        {
          input: {},
          reason: "复核最近写操作",
          workflowName: "AUDIT_REVIEW",
        },
      ],
      summary: "需要并行处理内容和审计。",
    });
  });

  it("limits normalized plans to six child tasks", () => {
    expect(
      normalizeMultiTaskPlan({
        taskNames: [
          "comment_moderation_analysis",
          "article_assistance",
          "site_config_review",
          "audit_review",
          "comment_moderation_analysis",
          "article_assistance",
          "site_config_review",
        ],
      }),
    ).toHaveLength(6);
  });

  it("creates a generic approval request for planned business actions", () => {
    const plan = [
      {
        input: {
          scope: "today",
        },
        reason: "检查评论风险。",
        workflowName: "COMMENT_MODERATION_ANALYSIS" as const,
      },
    ];

    expect(
      createMultiTaskApprovalRequest({
        plan,
        summary: "已规划评论治理。",
      }),
    ).toEqual({
      action: "APPROVE_MULTI_TASK_PLAN",
      payload: {
        plan,
      },
      question: "是否确认启动 1 个 Agent 业务处理？",
      subject: "MULTI_TASK",
      summary: "已规划评论治理。",
    });
  });

  it("rejects LLM planning responses without a JSON object", () => {
    expect(() => parseMultiTaskPlanResponse("no json here")).toThrow(
      "Multi-task orchestration response did not contain JSON.",
    );
  });

  it("converts persisted child runs into business child results", () => {
    expect(
      toMultiTaskChildResult(
        createRun({
          dedupeKey: "multi-task-child:parent:0:abcdef1234567890",
          errorMessage: "等待审批",
          interruption: { kind: "ADMIN_AGENT_APPROVAL" },
          status: "WAITING_FOR_APPROVAL",
          summary: "站点配置需要确认。",
          workflowName: "SITE_CONFIG_REVIEW",
        }),
      ),
    ).toEqual({
      childTaskKey: "multi-task-child:parent:0:abcdef1234567890",
      errorMessage: "等待审批",
      interruptionKind: "ADMIN_AGENT_APPROVAL",
      output: null,
      runId: "run-1",
      status: "WAITING_FOR_APPROVAL",
      summary: "站点配置需要确认。",
      workflowName: "SITE_CONFIG_REVIEW",
    });
  });

  it("converts child workflow results into business child results", () => {
    const run = createRun({
      dedupeKey: "multi-task-child:parent:0:abcdef1234567890",
      errorMessage: null,
      id: "child-run-1",
      interruption: { kind: "COMMENT_MODERATION_APPROVAL" },
      status: "WAITING_FOR_APPROVAL",
      summary: "等待评论治理确认。",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(
      createMultiTaskChildResultFromWorkflowResult({
        result: {
          interruption: {
            action: "HIDE_COMMENT",
            approvalId: "approval-1",
            findingIds: ["finding-1"],
            kind: "COMMENT_MODERATION_APPROVAL",
            options: [],
            payload: { findingIds: ["finding-1"], scope: "today" },
            question: "确认屏蔽 1 条评论？",
            scope: "today",
            subject: "ARTICLE_COMMENT",
            summary: "确认后将屏蔽 1 条评论。",
          },
          output: { findingCount: 1 },
          run,
          summary: "等待评论治理确认。",
        },
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).toEqual({
      childTaskKey: "multi-task-child:parent:0:abcdef1234567890",
      errorMessage: null,
      interruptionKind: "COMMENT_MODERATION_APPROVAL",
      output: { findingCount: 1 },
      runId: "child-run-1",
      status: "WAITING_FOR_APPROVAL",
      summary: "等待评论治理确认。",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
  });

  it("creates failed child results without leaking application errors into callers", () => {
    expect(
      createMultiTaskChildFailureResult({
        childTaskKey: "multi-task-child:parent:0:abcdef1234567890",
        errorMessage: "child failed",
        runId: "child-run-1",
        workflowName: "AUDIT_REVIEW",
      }),
    ).toEqual({
      childTaskKey: "multi-task-child:parent:0:abcdef1234567890",
      errorMessage: "child failed",
      interruptionKind: null,
      output: null,
      runId: "child-run-1",
      status: "FAILED",
      summary: "child failed",
      workflowName: "AUDIT_REVIEW",
    });
  });

  it("reads child workflow dedupe keys from persisted runs", () => {
    expect(toWorkflowRunDedupeKey(createRun({ dedupeKey: " direct-key " }))).toBe("direct-key");
    expect(
      toWorkflowRunDedupeKey(
        createRun({
          dedupeKey: null,
          metadata: {
            dedupeKey: " metadata-key ",
          },
        }),
      ),
    ).toBe("metadata-key");
    expect(toWorkflowRunDedupeKey(createRun({ dedupeKey: null, metadata: {} }))).toBeNull();
  });

  it("creates stable child workflow dedupe keys from workflow and input", () => {
    const left = toMultiTaskChildDedupeKey("parent-run", 2, {
      input: {
        filter: {
          a: 1,
          b: 2,
        },
      },
      reason: "test",
      workflowName: "AUDIT_REVIEW",
    });
    const right = toMultiTaskChildDedupeKey("parent-run", 2, {
      input: {
        filter: {
          b: 2,
          a: 1,
        },
      },
      reason: "different reason should not affect dedupe",
      workflowName: "AUDIT_REVIEW",
    });
    const reordered = toMultiTaskChildDedupeKey("parent-run", 0, {
      input: {
        filter: {
          b: 2,
          a: 1,
        },
      },
      reason: "same task moved to a different plan position",
      workflowName: "AUDIT_REVIEW",
    });
    const differentInput = toMultiTaskChildDedupeKey("parent-run", 0, {
      input: {
        filter: {
          a: 1,
          b: 3,
        },
      },
      reason: "different input should create a different child task",
      workflowName: "AUDIT_REVIEW",
    });

    expect(left).toBe(right);
    expect(left).toBe(reordered);
    expect(left).not.toBe(differentInput);
    expect(left).toMatch(/^multi-task-child:parent-run:AUDIT_REVIEW:[0-9a-f]{16}$/);
  });

  it("creates a stable output envelope for multi-task runs", () => {
    const plan = [createPlanItem("COMMENT_MODERATION_ANALYSIS"), createPlanItem("AUDIT_REVIEW")];
    const childResults = [createChildResult("COMPLETED"), createChildResult("FAILED")];

    expect(createMultiTaskOrchestrationOutput({ childResults, plan, summary: "规划完成" })).toEqual(
      {
        childResults,
        plan,
        planSummary: "规划完成",
        plannedTaskCount: 2,
      },
    );
  });

  it("restores persisted multi-task plans from workflow output", () => {
    const plan = [createPlanItem("COMMENT_MODERATION_ANALYSIS"), createPlanItem("AUDIT_REVIEW")];
    const output = createMultiTaskOrchestrationOutput({
      childResults: [],
      plan,
      summary: "规划完成",
    });

    expect(toMultiTaskPlanFromOutput(output)).toEqual(plan);
  });

  it("summarizes empty plans without pretending child workflows ran", () => {
    expect(buildMultiTaskSummary({ childResults: [], plan: [], summary: "" })).toBe(
      "多任务编排已完成，未启动 Agent 业务处理。",
    );
  });

  it("summarizes child workflow outcomes", () => {
    expect(
      buildMultiTaskSummary({
        childResults: [
          createChildResult("COMPLETED"),
          createChildResult("WAITING_FOR_APPROVAL"),
          createChildResult("FAILED"),
        ],
        plan: [
          createPlanItem("COMMENT_MODERATION_ANALYSIS"),
          createPlanItem("SITE_CONFIG_REVIEW"),
          createPlanItem("AUDIT_REVIEW"),
        ],
        summary: "多任务编排已规划 3 个子任务。",
      }),
    ).toBe("多任务编排已规划 3 个子任务。\n结果：完成 1 个，等待确认 1 个，失败 1 个。");
  });

  it("creates a completion result from child outcomes", () => {
    const plan = [createPlanItem("COMMENT_MODERATION_ANALYSIS"), createPlanItem("AUDIT_REVIEW")];
    const childResults = [createChildResult("COMPLETED"), createChildResult("FAILED")];

    expect(
      createMultiTaskCompletionResult({
        childResults,
        plan,
        summary: "多任务编排已规划 2 个子任务。",
      }),
    ).toEqual({
      output: {
        childResults,
        plan,
        planSummary: "多任务编排已规划 2 个子任务。",
        plannedTaskCount: 2,
      },
      summary: "多任务编排已规划 2 个子任务。\n结果：完成 1 个，等待确认 0 个，失败 1 个。",
    });
  });
});

function createPlanItem(workflowName: MultiTaskPlanItem["workflowName"]): MultiTaskPlanItem {
  return {
    input: {},
    reason: "test",
    workflowName,
  };
}

function createChildResult(status: string): MultiTaskChildResult {
  return {
    childTaskKey: `child-key-${status}`,
    errorMessage: status === "FAILED" ? "failed" : null,
    interruptionKind: status === "WAITING_FOR_APPROVAL" ? "ADMIN_AGENT_APPROVAL" : null,
    output: null,
    runId: `run-${status}`,
    status,
    summary: status,
    workflowName: "COMMENT_MODERATION_ANALYSIS",
  };
}

function createRun(overrides: Partial<AdminAgentRun>): AdminAgentRun {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    currentNode: null,
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: null,
    status: "PENDING",
    summary: null,
    threadId: "thread-1",
    type: "MULTI_TASK_ORCHESTRATION",
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
    workflowName: "MULTI_TASK_ORCHESTRATION",
    ...overrides,
  };
}
