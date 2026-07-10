import { describe, expect, it } from "vitest";
import {
  createAgentContextRegistry,
  selectLandingCapabilitySuggestions,
} from "./agent-context-registry";
import { adminAgentTaskCatalog } from "@adrian-zephyr-notes/contracts";
import type {
  AdminAgentFindingResponse,
  AdminAgentHomeResponse,
  AdminAgentTaskSummaryResponse,
} from "@adrian-zephyr-notes/contracts";

describe("agent context registry", () => {
  it("uses the home task catalog as the startable task source", () => {
    const registry = createAgentContextRegistry(createHomeResponse());
    const businessTaskContext = JSON.parse(registry.entries[3]?.value ?? "{}") as {
      availableBusinessTasks?: Array<{
        requiresApprovalForWrites: boolean;
        supportsHumanApproval: boolean;
        supportsStart: boolean;
        taskName: string;
      }>;
    };

    expect(businessTaskContext.availableBusinessTasks?.map((task) => task.taskName)).toEqual(
      adminAgentTaskCatalog.filter((task) => task.supportsStart).map((task) => task.taskName),
    );
    expect(
      businessTaskContext.availableBusinessTasks?.find(
        (task) => task.taskName === "article_assistance",
      ),
    ).toMatchObject({
      requiresApprovalForWrites: false,
      supportsHumanApproval: true,
    });
  });

  it("keeps implemented task domains visible and startable", () => {
    expect(adminAgentTaskCatalog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          availability: "AVAILABLE",
          requiresApprovalForWrites: true,
          supportsHumanApproval: true,
          supportsStart: true,
          taskName: "comment_moderation_analysis",
        }),
        expect.objectContaining({
          availability: "AVAILABLE",
          requiresApprovalForWrites: false,
          supportsHumanApproval: true,
          supportsStart: true,
          taskName: "article_assistance",
        }),
        expect.objectContaining({
          availability: "AVAILABLE",
          requiresApprovalForWrites: false,
          supportsHumanApproval: true,
          supportsStart: true,
          taskName: "audit_review",
        }),
        expect.objectContaining({
          availability: "AVAILABLE",
          capabilityId: null,
          requiresApprovalForWrites: true,
          supportsHumanApproval: true,
          supportsStart: true,
          taskName: "multi_task_orchestration",
        }),
        expect.objectContaining({
          availability: "AVAILABLE",
          requiresApprovalForWrites: true,
          supportsHumanApproval: true,
          supportsStart: true,
          taskName: "site_config_review",
        }),
      ]),
    );
  });

  it("builds landing suggestions from registered capabilities", () => {
    expect(
      selectLandingCapabilitySuggestions([
        {
          description: "解释最近管理动作、追踪治理记录，并辅助定位风险操作。",
          id: "audit",
          requiresApprovalForWrites: false,
          status: "AVAILABLE",
          supportsChat: true,
          title: "审计日志",
        },
        {
          description: "分析文章评论、生成风险建议，并在管理员确认后执行治理动作。",
          id: "comments",
          requiresApprovalForWrites: true,
          status: "AVAILABLE",
          supportsChat: true,
          title: "评论治理",
        },
        {
          description: "协助选题、草稿检查、发布前巡检和摘要生成。",
          id: "articles",
          requiresApprovalForWrites: true,
          status: "PLANNED",
          supportsChat: true,
          title: "文章工作台",
        },
        {
          description: "巡检首页、导航、公告和社交链接，生成可确认的站点管理规划。",
          id: "site",
          requiresApprovalForWrites: true,
          status: "AVAILABLE",
          supportsChat: true,
          title: "站点巡检",
        },
      ]).map((suggestion) => [suggestion.id, suggestion.title, suggestion.description]),
    ).toEqual([
      ["comments", "分析今日评论", "找出需要人工确认的风险"],
      ["articles", "进入文章工作台", "协助选题、草稿检查、发布前巡检和摘要生成。"],
      ["site", "巡检站点配置", "巡检首页、导航、公告和社交链接，生成可确认的站点管理规划。"],
      ["audit", "查看审计日志", "解释最近管理动作、追踪治理记录，并辅助定位风险操作。"],
    ]);
  });

  it("registers workbench state as LLM-readable context", () => {
    const registry = createAgentContextRegistry(createHomeResponse(), [
      createTask({
        id: "run-retryable",
        latestEvent: {
          createdAt: "2026-07-04T00:02:00.000Z",
          description: "评论治理处理失败，可重新尝试。",
          id: "event-failed",
          status: "FAILED",
          title: "处理失败",
        },
        status: "FAILED",
        summary: "上一次评论治理失败。",
      }),
    ]);

    expect(registry.entries.map((entry) => entry.id)).toEqual([
      "comments.summary",
      "workspace.capabilities",
      "workspace.agentApprovalOperations",
      "workspace.businessTaskContext",
      "comments.actionableFindings",
      "capability.comments",
      "capability.articles",
      "capability.site",
      "capability.audit",
    ]);
    expect(registry.entries[0]?.value).toContain('"pendingFindingCount":1');
    expect(registry.entries[2]?.value).not.toContain("request_comment_moderation_confirmation");
    expect(registry.entries[2]?.value).toContain("agent_task_resume");
    expect(registry.entries[2]?.value.toLowerCase()).toContain(
      "do not create direct write operations",
    );
    expect(registry.entries[2]?.value).toContain("finding IDs");
    expect(registry.entries[2]?.value).toContain("render action payloads");
    expect(registry.entries[2]?.value).not.toContain("validProposedActions");
    expect(registry.entries[2]?.value).not.toMatch(
      /"action":"hide"|"action":"ignore"|"action":"restore"/,
    );
    expect(registry.entries[3]?.value).toContain("control_admin_agent_task");
    expect(registry.entries[3]?.value).toContain("start_admin_agent_task");
    expect(registry.entries[3]?.value).toContain("private business-task context");
    expect(registry.entries[3]?.value).toContain("latestAttemptTaskId");
    expect(registry.entries[3]?.value).toContain("sourceTaskId");
    expect(registry.entries[3]?.value).toContain("Do not mention internal implementation details");
    expect(registry.entries[3]?.value).not.toContain("debug panels");
    expect(registry.entries[3]?.value).not.toContain("execution graph details");
    const agentRecoveryContext = JSON.parse(registry.entries[3]?.value ?? "{}") as {
      availableBusinessTasks?: Array<{
        description?: string;
        taskName?: string;
        title?: string;
      }>;
      instruction?: string;
      recentBusinessTasks?: Array<{
        availableActions?: Array<{ action: string }>;
        latestEvent?: {
          description: string | null;
          status: string;
          title: string;
          updatedAt: string;
        } | null;
        taskId: string;
      }>;
    };
    expect(agentRecoveryContext.availableBusinessTasks?.map((task) => task.taskName)).toEqual(
      createHomeResponse().tasks.map((task) => task.taskName),
    );
    expect(agentRecoveryContext.recentBusinessTasks).toEqual([
      expect.objectContaining({
        availableActions: [expect.objectContaining({ action: "retry" })],
        latestEvent: {
          description: "评论治理处理失败，可重新尝试。",
          status: "FAILED",
          title: "处理失败",
          updatedAt: "2026-07-04T00:02:00.000Z",
        },
        taskId: "run-retryable",
      }),
    ]);
    const visibleRecoveryCopy = [
      agentRecoveryContext.instruction,
      ...(agentRecoveryContext.availableBusinessTasks ?? []).flatMap((businessTask) => [
        businessTask.description,
        businessTask.title,
      ]),
    ].join("\n");
    expect(visibleRecoveryCopy).not.toContain("LangGraph");
    expect(visibleRecoveryCopy).not.toContain("orchestration");
    expect(visibleRecoveryCopy).not.toContain("framework");
    expect(visibleRecoveryCopy).not.toContain("checkpoint");
    expect(visibleRecoveryCopy).not.toContain("nodes");
    expect(visibleRecoveryCopy).not.toContain("threads");
    expect(registry.entries[3]?.value).toContain("Only describe the business action");
    expect(registry.entries[3]?.value).toContain("comment_moderation_analysis");
    expect(registry.entries[3]?.value).toContain("article_assistance");
    expect(registry.entries[3]?.value).toContain("multi_task_orchestration");
    expect(registry.entries[3]?.value).toContain("run-retryable");
    expect(registry.entries[3]?.value).not.toContain("currentNode");
    expect(registry.entries[3]?.value).not.toContain("threadId");
    expect(registry.entries[3]?.value).not.toContain("workflowName");
    expect(registry.entries[3]?.value).not.toContain("availableCollaborations");
    expect(registry.entries[3]?.value).not.toContain("recentCollaborations");
    expect(registry.entries[3]?.title).toBe("Agent 业务处理上下文");
    expect(registry.entries[3]?.description).not.toContain("任务面板");
    expect(registry.entries[5]?.description).not.toContain("支持后台运行");
    expect(registry.entries.map((entry) => entry.value).join("\n")).not.toContain("supportsRun");
    expect(registry.entries.map((entry) => entry.id)).not.toContain("agent.activeRun");
    expect(registry.entries.map((entry) => entry.id).join("\n")).not.toContain("workflowRuns");
  });

  it("groups recent child business tasks under their parent business action", () => {
    const registry = createAgentContextRegistry(createHomeResponse(), [
      createTask({
        id: "parent-run",
        status: "COMPLETED",
        summary: "跨域协作已启动 2 个业务处理。",
        taskName: "multi_task_orchestration",
      }),
      createTask({
        id: "child-comments",
        parentTaskId: "parent-run",
        relation: "child",
        status: "WAITING_FOR_APPROVAL",
        summary: "评论治理等待确认。",
        taskName: "comment_moderation_analysis",
      }),
      createTask({
        id: "child-audit",
        parentTaskId: "parent-run",
        relation: "child",
        status: "COMPLETED",
        summary: "审计分析已完成。",
        taskName: "audit_review",
      }),
    ]);
    const businessTaskContext = JSON.parse(registry.entries[3]?.value ?? "{}") as {
      recentBusinessTasks?: Array<{
        childBusinessTasks?: Array<{
          availableActions?: Array<{ action: string }>;
          parentTaskId: string | null;
          status: string;
          summary: string | null;
          taskId: string;
          taskName: string;
        }>;
        availableActions?: Array<{ action: string }>;
        taskId: string;
      }>;
    };

    expect(businessTaskContext.recentBusinessTasks).toEqual([
      expect.objectContaining({
        childBusinessTasks: [
          expect.objectContaining({
            availableActions: [
              expect.objectContaining({ action: "cancel" }),
              expect.objectContaining({ action: "branch" }),
            ],
            parentTaskId: "parent-run",
            status: "WAITING_FOR_APPROVAL",
            summary: "评论治理等待确认。",
            taskId: "child-comments",
            taskName: "comment_moderation_analysis",
          }),
          expect.objectContaining({
            availableActions: [expect.objectContaining({ action: "retry" })],
            parentTaskId: "parent-run",
            status: "COMPLETED",
            summary: "审计分析已完成。",
            taskId: "child-audit",
            taskName: "audit_review",
          }),
        ],
        taskId: "parent-run",
      }),
    ]);
    expect(JSON.stringify(businessTaskContext)).not.toMatch(
      /LangGraph|checkpoint|threadId|workflowName|currentNode/,
    );
  });

  it("does not group branch or retry runs as parent business children", () => {
    const registry = createAgentContextRegistry(createHomeResponse(), [
      createTask({
        id: "parent-run",
        status: "WAITING_FOR_APPROVAL",
        summary: "评论治理等待确认。",
        taskName: "comment_moderation_analysis",
      }),
      createTask({
        id: "branch-run",
        parentTaskId: "parent-run",
        relation: "branch",
        status: "WAITING_FOR_APPROVAL",
        summary: "已另开一条审批分支。",
        taskName: "comment_moderation_analysis",
      }),
      createTask({
        id: "retry-run",
        parentTaskId: "parent-run",
        relation: "retry",
        status: "RUNNING",
        summary: "正在重试评论治理。",
        taskName: "comment_moderation_analysis",
      }),
      createTask({
        id: "child-audit",
        parentTaskId: "parent-run",
        relation: "child",
        status: "COMPLETED",
        summary: "审计分析已完成。",
        taskName: "audit_review",
      }),
    ]);
    const businessTaskContext = JSON.parse(registry.entries[3]?.value ?? "{}") as {
      recentBusinessTasks?: Array<{
        childBusinessTasks?: Array<{
          taskId: string;
        }>;
        taskId: string;
      }>;
    };
    const parentTask = businessTaskContext.recentBusinessTasks?.find(
      (task) => task.taskId === "parent-run",
    );

    expect(parentTask?.childBusinessTasks?.map((task) => task.taskId)).toEqual(["child-audit"]);
    expect(JSON.stringify(parentTask)).not.toContain("branch-run");
    expect(JSON.stringify(parentTask)).not.toContain("retry-run");
  });

  it("uses the latest retry attempt as a child business task's effective state", () => {
    const registry = createAgentContextRegistry(createHomeResponse(), [
      createTask({
        id: "parent-run",
        status: "COMPLETED",
        summary: "跨域协作已启动业务处理。",
        taskName: "multi_task_orchestration",
        updatedAt: "2026-07-04T00:01:00.000Z",
      }),
      createTask({
        id: "child-comments",
        parentTaskId: "parent-run",
        relation: "child",
        status: "FAILED",
        summary: "评论治理失败。",
        taskName: "comment_moderation_analysis",
        updatedAt: "2026-07-04T00:02:00.000Z",
      }),
      createTask({
        id: "retry-old",
        parentTaskId: "child-comments",
        relation: "retry",
        status: "FAILED",
        summary: "第一次重试失败。",
        taskName: "comment_moderation_analysis",
        updatedAt: "2026-07-04T00:03:00.000Z",
      }),
      createTask({
        id: "retry-latest",
        parentTaskId: "child-comments",
        relation: "retry",
        status: "COMPLETED",
        summary: "评论治理重试完成。",
        taskName: "comment_moderation_analysis",
        updatedAt: "2026-07-04T00:04:00.000Z",
      }),
    ]);
    const businessTaskContext = JSON.parse(registry.entries[3]?.value ?? "{}") as {
      recentBusinessTasks?: Array<{
        childBusinessTasks?: Array<{
          availableActions?: Array<{ action: string }>;
          latestAttemptTaskId?: string;
          parentTaskId: string | null;
          relationToParent?: string;
          sourceTaskId?: string;
          status: string;
          summary: string | null;
          taskId: string;
        }>;
        taskId: string;
      }>;
    };
    const parentTask = businessTaskContext.recentBusinessTasks?.find(
      (task) => task.taskId === "parent-run",
    );

    expect(parentTask?.childBusinessTasks).toEqual([
      expect.objectContaining({
        availableActions: [expect.objectContaining({ action: "retry" })],
        latestAttemptTaskId: "retry-latest",
        parentTaskId: "parent-run",
        relationToParent: "child",
        sourceTaskId: "child-comments",
        status: "COMPLETED",
        summary: "评论治理重试完成。",
        taskId: "retry-latest",
      }),
    ]);
    expect(JSON.stringify(parentTask)).toContain("child-comments");
    expect(JSON.stringify(parentTask)).not.toContain("retry-old");
  });

  it("keeps re-judgeable findings available to the LLM context", () => {
    const registry = createAgentContextRegistry(
      createHomeResponse({
        findings: [
          createFinding({ id: "failed-finding", status: "FAILED" }),
          createFinding({ id: "restored-finding", status: "RESTORED" }),
        ],
      }),
    );
    const actionableFindingsContext = registry.entries.find(
      (entry) => entry.id === "comments.actionableFindings",
    );

    expect(actionableFindingsContext?.value).toContain("failed-finding");
    expect(actionableFindingsContext?.value).toContain("restored-finding");
  });
});

function createHomeResponse(
  overrides: Partial<AdminAgentHomeResponse> = {},
): AdminAgentHomeResponse {
  return {
    assistantBrief: "",
    automationCandidateCount: 0,
    automationPolicy: {
      autoHideEnabled: false,
      confidenceThreshold: 0.95,
      eligibleCategories: ["ABUSE"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: true,
    },
    capabilities: [
      {
        description: "分析文章评论。",
        id: "comments",
        requiresApprovalForWrites: true,
        status: "AVAILABLE",
        supportsChat: true,
        title: "评论治理",
      },
      {
        description: "协助选题、草稿检查、发布前巡检和摘要生成。",
        id: "articles",
        requiresApprovalForWrites: true,
        status: "PLANNED",
        supportsChat: true,
        title: "文章工作台",
      },
      {
        description: "巡检首页、导航、公告和社交链接。",
        id: "site",
        requiresApprovalForWrites: true,
        status: "AVAILABLE",
        supportsChat: true,
        title: "站点巡检",
      },
      {
        description: "解释最近管理动作、追踪治理记录。",
        id: "audit",
        requiresApprovalForWrites: false,
        status: "AVAILABLE",
        supportsChat: true,
        title: "审计日志",
      },
    ],
    executedActionCount: 3,
    findings: [],
    lastUpdatedAt: "2026-07-05T00:00:00.000Z",
    pendingFindingCount: 1,
    recentActions: [],
    tasks: [...adminAgentTaskCatalog],
    todayCommentCount: 4,
    todayHiddenCommentCount: 1,
    todayVisibleCommentCount: 3,
    ...overrides,
  };
}

function createFinding(
  overrides: Partial<AdminAgentFindingResponse> = {},
): AdminAgentFindingResponse {
  return {
    automationEligibility: null,
    category: "ABUSE",
    confidence: 0.9,
    createdAt: "2026-07-04T00:00:00.000Z",
    evidence: ["辱骂"],
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "评论包含辱骂。",
    taskId: "run-1",
    severity: "HIGH",
    status: "PENDING",
    target: null,
    targetId: "comment-1",
    targetType: "ARTICLE_COMMENT",
    ...overrides,
  };
}

function createTask(
  overrides: Partial<AdminAgentTaskSummaryResponse> = {},
): AdminAgentTaskSummaryResponse {
  return {
    createdAt: "2026-07-04T00:00:00.000Z",
    errorMessage: null,
    id: "run-1",
    latestEvent: null,
    parentTaskId: null,
    relation: null,
    status: "COMPLETED",
    summary: "评论治理 Agent 任务已完成。",
    updatedAt: "2026-07-04T00:01:00.000Z",
    taskName: "comment_moderation_analysis",
    ...overrides,
  };
}
