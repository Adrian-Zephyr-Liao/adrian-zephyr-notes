import { describe, expect, it } from "vitest";
import type { AdminAgentHome } from "../application/get-admin-agent-home.use-case";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import type { AdminAgentWorkflowEvent } from "../domain/admin-agent-workflow-event.entity";
import { listAdminAgentCapabilities } from "../domain/admin-agent-capability";
import { listAdminAgentWorkflowTasks } from "../domain/admin-agent-workflow-metadata";
import {
  toAdminAgentFindingResponse,
  toAdminAgentHomeResponse,
  toAdminAgentTaskListResponse,
  toAdminAgentTaskResponse,
} from "./admin-agent-home.mapper";

describe("toAdminAgentHomeResponse", () => {
  it("includes automation eligibility for findings using the home policy", () => {
    const response = toAdminAgentHomeResponse(
      createHome({
        automationPolicy: {
          autoHideEnabled: true,
          confidenceThreshold: 0.95,
          eligibleCategories: ["SPAM", "ABUSE"],
          mode: "MANUAL_REVIEW",
          requiresStrongEvidence: true,
        },
        findings: [
          createFinding({
            confidence: 0.98,
            evidence: ["评论包含广告引流话术。"],
          }),
        ],
      }),
    );

    expect(response.findings[0]?.automationEligibility).toEqual({
      action: "AUTO_HIDE_COMMENT",
      eligible: true,
    });
  });

  it("still reports candidate eligibility while automatic execution is disabled", () => {
    const response = toAdminAgentHomeResponse(
      createHome({
        findings: [
          createFinding({
            confidence: 0.98,
            evidence: ["评论包含广告引流话术。"],
          }),
        ],
      }),
    );

    expect(response.findings[0]?.automationEligibility).toEqual({
      action: "AUTO_HIDE_COMMENT",
      eligible: true,
    });
  });

  it("exposes the registered Agent capabilities on the home response", () => {
    const response = toAdminAgentHomeResponse(createHome());

    expect(response.capabilities.map((capability) => capability.id)).toEqual([
      "comments",
      "articles",
      "guestbook",
      "site",
      "audit",
    ]);
    expect(response.capabilities[0]).toMatchObject({
      id: "comments",
      requiresApprovalForWrites: true,
      status: "AVAILABLE",
      supportsChat: true,
    });
    expect(response.tasks.map((task) => task.taskName)).toEqual([
      "comment_moderation_analysis",
      "article_assistance",
      "site_config_review",
      "audit_review",
      "multi_task_orchestration",
    ]);
    expect(response.tasks[0]).toMatchObject({
      availability: "AVAILABLE",
      capabilityId: "comments",
      controls: [
        expect.objectContaining({ action: "cancel", title: "取消" }),
        expect.objectContaining({ action: "branch", title: "另开处理" }),
        expect.objectContaining({ action: "retry", title: "重新尝试" }),
      ],
      supportsStart: true,
      taskName: "comment_moderation_analysis",
    });
    expect(
      response.tasks
        .find((task) => task.taskName === "multi_task_orchestration")
        ?.controls.map((control) => control.action),
    ).toEqual(["cancel", "branch", "retry", "refresh"]);
    expect(response.tasks.find((task) => task.taskName === "article_assistance")).toMatchObject({
      requiresApprovalForWrites: false,
      supportsHumanApproval: true,
    });
  });
});

describe("toAdminAgentFindingResponse", () => {
  it("does not infer automation eligibility without an explicit policy context", () => {
    expect(toAdminAgentFindingResponse(createFinding()).automationEligibility).toBeNull();
  });

  it("exposes the source task as taskId instead of the internal run id field name", () => {
    const response = toAdminAgentFindingResponse(createFinding());

    expect(response.taskId).toBe("run-1");
    expect(response).not.toHaveProperty("runId");
  });
});

describe("toAdminAgentTaskResponse", () => {
  it("adds the latest business progress event to task list summaries", () => {
    const response = toAdminAgentTaskListResponse({
      data: [createRun()],
      latestEventsByRunId: new Map([
        [
          "run-1",
          createWorkflowEvent({
            id: "event-latest",
            summary: "Opened /agent/runs/thread-1 LangGraph checkpoint view.",
            type: "FAILED",
          }),
        ],
      ]),
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });

    expect(response.data[0]).toMatchObject({
      id: "run-1",
      latestEvent: {
        createdAt: "2026-07-04T03:00:00.000Z",
        description: null,
        id: "event-latest",
        status: "FAILED",
        title: "处理失败",
      },
    });
    expect(JSON.stringify(response.data[0]?.latestEvent)).not.toMatch(
      /LangGraph|checkpoint|threadId|workflowName|agent\/runs|运行面板|运行态|运行时/,
    );
  });

  it("keeps task output business-facing without exposing workflow runtime details", () => {
    const response = toAdminAgentTaskResponse({
      interruption: null,
      output: {
        actionResult: null,
        findingCount: 2,
        nested: {
          checkpointId: "checkpoint-1",
          retained: "business value",
          threadId: "thread-1",
        },
        notes: ["kept", "Opened /agent/runs/thread-1 LangGraph checkpoint view."],
        scope: "today",
        workflow: "comment_moderation",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
      run: createRun(),
      summary: "评论治理任务已完成。",
      events: [
        createWorkflowEvent({
          id: "event-1",
          summary: "评论治理分析任务已创建。",
          type: "RUN_CREATED",
        }),
        createWorkflowEvent({
          id: "event-2",
          payload: {
            action: "branch",
            resultRunId: "run-2",
            resultStatus: "RUNNING",
          },
          summary: "Opened /agent/runs/thread-1 LangGraph checkpoint view.",
          type: "CONTROLLED",
        }),
        createWorkflowEvent({
          id: "event-3",
          summary: "评论治理分析等待管理员确认。",
          type: "INTERRUPTED",
        }),
      ],
    });

    expect(response.output).toEqual({
      actionResult: null,
      findingCount: 2,
      nested: {
        retained: "business value",
      },
      notes: ["kept"],
      scope: "today",
    });
    expect(JSON.stringify(response.output)).not.toMatch(
      /LangGraph|checkpoint|threadId|workflowName|comment_moderation|agent\/runs/,
    );
    expect(response.task).toMatchObject({
      id: "run-1",
      taskName: "comment_moderation_analysis",
    });
    expect(response.events).toEqual([
      {
        createdAt: "2026-07-04T03:00:00.000Z",
        description: "评论治理分析任务已创建。",
        id: "event-1",
        status: "COMPLETED",
        title: "创建任务",
      },
      {
        createdAt: "2026-07-04T03:00:00.000Z",
        description: null,
        id: "event-2",
        status: "IN_PROGRESS",
        title: "另开处理",
      },
      {
        createdAt: "2026-07-04T03:00:00.000Z",
        description: "评论治理分析等待管理员确认。",
        id: "event-3",
        status: "WAITING_FOR_APPROVAL",
        title: "等待确认",
      },
    ]);
    expect(JSON.stringify(response.events)).not.toMatch(
      /LangGraph|checkpoint|threadId|workflowName|agent\/runs|运行面板|运行态|运行时/,
    );
    expect(response).not.toHaveProperty("run");
  });
});

function createHome(overrides: Partial<AdminAgentHome> = {}): AdminAgentHome {
  return {
    assistantBrief: "今天有风险建议等待处理。",
    automationPolicy: {
      autoHideEnabled: false,
      confidenceThreshold: 0.95,
      eligibleCategories: ["SPAM", "ABUSE"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: true,
    },
    automationCandidateCount: 0,
    capabilities: listAdminAgentCapabilities(),
    executedActionCount: 0,
    findings: [],
    lastUpdatedAt: new Date("2026-07-04T04:00:00.000Z"),
    pendingFindingCount: 1,
    recentActions: [],
    tasks: listAdminAgentWorkflowTasks(),
    todayCommentCount: 3,
    todayHiddenCommentCount: 0,
    todayVisibleCommentCount: 3,
    ...overrides,
  };
}

function createRun(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-04T03:00:00.000Z"),
    currentNode: "completed",
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
    startedByUserId: "admin-1",
    status: "COMPLETED",
    summary: "评论治理任务已完成。",
    threadId: "thread-1",
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T03:01:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}

function createWorkflowEvent(
  overrides: Partial<AdminAgentWorkflowEvent> = {},
): AdminAgentWorkflowEvent {
  return {
    createdAt: new Date("2026-07-04T03:00:00.000Z"),
    id: "event-1",
    node: null,
    payload: null,
    runId: "run-1",
    summary: null,
    type: "RUN_CREATED",
    ...overrides,
  };
}

function createFinding(overrides: Partial<AdminAgentFinding> = {}): AdminAgentFinding {
  return {
    category: "SPAM",
    confidence: 0.98,
    createdAt: new Date("2026-07-04T03:00:00.000Z"),
    evidence: ["广告"],
    executedAt: null,
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "疑似广告评论。",
    runId: "run-1",
    severity: "HIGH",
    status: "PENDING",
    target: null,
    targetId: "comment-1",
    targetType: "ARTICLE_COMMENT",
    updatedAt: new Date("2026-07-04T03:00:00.000Z"),
    ...overrides,
  };
}
