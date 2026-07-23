import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import {
  AdminAgentWorkflowActiveRunRetryError,
  AdminAgentWorkflowCancelUnavailableError,
  AdminAgentWorkflowNotFoundError,
  AdminAgentWorkflowBranchUnavailableError,
  AdminAgentWorkflowResumeUnavailableError,
  AdminAgentWorkflowResumeUnsupportedError,
  AdminAgentWorkflowStartUnsupportedError,
  AdminAgentWorkflowUnsupportedError,
} from "../application/manage-admin-agent-workflows.use-case";
import {
  AdminAgentWorkflowExecutionError,
  AdminAgentWorkflowInvalidResumeError,
} from "../domain/admin-agent-workflow-runner";
import { AdminAgentController } from "./admin-agent.controller";

describe("AdminAgentController", () => {
  it("lists root-level tasks through the workflow control plane", async () => {
    const listRuns = vi.fn().mockResolvedValue({
      data: [
        createRun({
          id: "parent-run",
          status: "COMPLETED",
          summary: "跨域协作已完成。",
          workflowName: "MULTI_TASK_ORCHESTRATION",
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 5,
        totalItems: 1,
        totalPages: 1,
      },
    });
    const controller = createController({ listRuns });

    await expect(
      controller.listTasks({
        page: 1,
        pageSize: 5,
        rootOnly: true,
        taskName: "ALL",
      }),
    ).resolves.toMatchObject({
      data: [
        {
          id: "parent-run",
          parentTaskId: null,
          relation: null,
          status: "COMPLETED",
          taskName: "multi_task_orchestration",
        },
      ],
    });
    expect(listRuns).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
      parentRunId: undefined,
      parentRunRelation: undefined,
      rootOnly: true,
      status: undefined,
      workflowName: undefined,
    });
  });

  it("maps public task relation filters to domain parent run relations", async () => {
    const listRuns = vi.fn().mockResolvedValue({
      data: [
        createRun({
          id: "child-run",
          parentRunId: "parent-run",
          parentRunRelation: "CHILD_TASK",
          workflowName: "COMMENT_MODERATION_ANALYSIS",
        }),
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      },
    });
    const controller = createController({ listRuns });

    await expect(
      controller.listTasks({
        parentTaskId: "parent-run",
        relation: "child",
      }),
    ).resolves.toMatchObject({
      data: [
        {
          id: "child-run",
          parentTaskId: "parent-run",
          relation: "child",
          taskName: "comment_moderation_analysis",
        },
      ],
    });
    expect(listRuns).toHaveBeenCalledWith({
      page: undefined,
      pageSize: undefined,
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
      rootOnly: undefined,
      status: undefined,
      workflowName: undefined,
    });
  });

  it("restores standard conversation messages including persisted A2UI activities", async () => {
    const execute = vi.fn().mockResolvedValue([
      {
        content: "上次的问题",
        id: "message-1",
        role: "user",
      },
      {
        activityType: "a2ui-surface",
        content: { a2ui_operations: [{ op: "beginRendering" }] },
        id: "comment-analysis-activity-analysis-1",
        role: "activity",
      },
    ]);
    const controller = createController({}, { execute });

    await expect(controller.listConversationMessages("conversation-1")).resolves.toEqual({
      data: [
        {
          content: "上次的问题",
          id: "message-1",
          role: "user",
        },
        {
          activityType: "a2ui-surface",
          content: { a2ui_operations: [{ op: "beginRendering" }] },
          id: "comment-analysis-activity-analysis-1",
          role: "activity",
        },
      ],
    });
    expect(execute).toHaveBeenCalledWith({ conversationId: "conversation-1" });
  });

  it("hides selected comment findings once and persists the replaced activity", async () => {
    const createdAt = new Date("2026-07-22T00:00:00.000Z");
    const execute = vi.fn().mockResolvedValue({
      analysis: {
        id: "analysis-1",
        output: { analyzedCount: 1, scope: "selection" },
        summary: "识别出 1 条高风险评论。",
      },
      findings: [
        {
          category: "ABUSE",
          confidence: 0.99,
          createdAt,
          evidence: ["明显辱骂"],
          executedAt: createdAt,
          id: "finding-1",
          proposedAction: "HIDE_COMMENT",
          reason: "评论包含明确人身攻击。",
          runId: "analysis-1",
          severity: "HIGH",
          status: "EXECUTED",
          target: {
            article: { id: "article-1", slug: "test", title: "测试文章" },
            author: { id: "user-1", login: "reader", name: null },
            body: "风险评论",
            createdAt,
            id: "comment-1",
            status: "HIDDEN",
          },
          targetId: "comment-1",
          targetType: "ARTICLE_COMMENT",
          updatedAt: createdAt,
        },
      ],
      result: {
        results: [{ findingId: "finding-1", status: "APPLIED" }],
      },
    });
    const recordMessage = vi.fn();
    const controller = createController({}, undefined, { execute }, { recordMessage });

    const response = await controller.hideCommentAnalysisFindings(
      "conversation-1",
      "analysis-1",
      { findingIds: ["finding-1"] },
      createAdminUser(),
      createRequest(),
    );

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "HIDE",
        analysisId: "analysis-1",
        findingIds: ["finding-1"],
      }),
    );
    expect(response).toMatchObject({
      activityMessage: {
        activityType: "a2ui-surface",
        id: "comment-analysis-activity-analysis-1",
        role: "activity",
      },
      analysisId: "analysis-1",
      appliedCount: 1,
      failedCount: 0,
    });
    expect(recordMessage).toHaveBeenCalledWith({
      conversationId: "conversation-1",
      message: response.activityMessage,
    });
  });

  it("does not expose persisted workflow events as a product endpoint", () => {
    const listRunEvents = vi.fn();
    const controller = createController({ listRunEvents }) as unknown as {
      listTaskEvents?: unknown;
    };

    expect(controller.listTaskEvents).toBeUndefined();
    expect(listRunEvents).not.toHaveBeenCalled();
  });

  it("starts manual tasks as root workflow runs", async () => {
    const startWorkflow = vi.fn().mockResolvedValue({
      interruption: null,
      output: {},
      run: createRun({
        id: "run-1",
        workflowName: "AUDIT_REVIEW",
      }),
      summary: "审计复核已启动。",
    });
    const controller = createController({ startWorkflow });

    await expect(
      controller.startTask(
        {
          input: {
            search: "comment",
          },
          taskName: "audit_review",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).resolves.toMatchObject({
      task: {
        id: "run-1",
        parentTaskId: null,
        taskName: "audit_review",
      },
    });
    expect(startWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          search: "comment",
        },
        workflowName: "AUDIT_REVIEW",
      }),
    );
    expect(startWorkflow.mock.calls[0]?.[0]).not.toHaveProperty("parentRunId");
  });

  it("maps resume conflicts to a recoverable HTTP response", async () => {
    const controller = createController({
      resumeRun: vi
        .fn()
        .mockRejectedValue(new AdminAgentWorkflowResumeUnavailableError("run-1", "COMPLETED")),
    });

    await expect(
      controller.resumeTask(
        "run-1",
        {
          resume: {
            decision: "APPROVE",
          },
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps active retry attempts to a recoverable HTTP response", async () => {
    const controller = createController({
      controlRun: vi
        .fn()
        .mockRejectedValue(new AdminAgentWorkflowActiveRunRetryError("run-1", "RUNNING")),
    });

    await expect(
      controller.controlTask("run-1", { action: "retry" }, createAdminUser(), createRequest()),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_ACTIVE_RETRY_DENIED",
        details: {
          status: "RUNNING",
          taskId: "run-1",
        },
      },
    });
    await expect(
      controller.controlTask("run-1", { action: "retry" }, createAdminUser(), createRequest()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps unavailable branch attempts to a recoverable HTTP response", async () => {
    const controller = createController({
      controlRun: vi
        .fn()
        .mockRejectedValue(new AdminAgentWorkflowBranchUnavailableError("run-1", "COMPLETED")),
    });

    await expect(
      controller.controlTask("run-1", { action: "branch" }, createAdminUser(), createRequest()),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_BRANCH_UNAVAILABLE",
        details: {
          status: "COMPLETED",
          taskId: "run-1",
        },
      },
    });
    await expect(
      controller.controlTask("run-1", { action: "branch" }, createAdminUser(), createRequest()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps unavailable cancellation attempts to a recoverable HTTP response", async () => {
    const controller = createController({
      controlRun: vi
        .fn()
        .mockRejectedValue(new AdminAgentWorkflowCancelUnavailableError("run-1", "COMPLETED")),
    });

    await expect(
      controller.controlTask("run-1", { action: "cancel" }, createAdminUser(), createRequest()),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_CANCEL_UNAVAILABLE",
        details: {
          status: "COMPLETED",
          taskId: "run-1",
        },
      },
    });
    await expect(
      controller.controlTask("run-1", { action: "cancel" }, createAdminUser(), createRequest()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps unsupported task starts without exposing workflow internals", async () => {
    const controller = createController({
      startWorkflow: vi
        .fn()
        .mockRejectedValue(
          new AdminAgentWorkflowUnsupportedError("workflow-definition", "AUDIT_REVIEW"),
        ),
    });

    await expect(
      controller.startTask(
        {
          taskName: "audit_review",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_UNSUPPORTED",
        details: {
          taskId: "workflow-definition",
        },
        message: "Agent task is not supported.",
      },
    });
    await expect(
      controller.startTask(
        {
          taskName: "audit_review",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toSatisfy((error: unknown) => !JSON.stringify(error).includes("workflowName"));
    await expect(
      controller.startTask(
        {
          taskName: "audit_review",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("maps non-startable registered tasks to a business validation response", async () => {
    const controller = createController({
      startWorkflow: vi
        .fn()
        .mockRejectedValue(
          new AdminAgentWorkflowStartUnsupportedError(
            "workflow-definition",
            "COMMENT_MODERATION_ANALYSIS",
          ),
        ),
    });

    await expect(
      controller.startTask(
        {
          taskName: "comment_moderation_analysis",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_START_UNSUPPORTED",
        details: {
          taskId: "workflow-definition",
        },
        message: "Agent task cannot be started.",
      },
    });
    await expect(
      controller.startTask(
        {
          taskName: "comment_moderation_analysis",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("maps failed agent executions to a retryable task response", async () => {
    const controller = createController({
      startWorkflow: vi
        .fn()
        .mockRejectedValue(
          new AdminAgentWorkflowExecutionError("run-1", "LLM response did not contain JSON.", null),
        ),
    });

    await expect(
      controller.startTask(
        {
          taskName: "comment_moderation_analysis",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_EXECUTION_FAILED",
        details: {
          taskId: "run-1",
        },
        message: "LLM response did not contain JSON.",
      },
    });
    await expect(
      controller.startTask(
        {
          taskName: "comment_moderation_analysis",
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps invalid approval resume payloads to a business validation response", async () => {
    const controller = createController({
      resumeRun: vi
        .fn()
        .mockRejectedValue(
          new AdminAgentWorkflowInvalidResumeError(
            "COMMENT_MODERATION_ANALYSIS",
            "Comment moderation resume payload requires APPROVE or DEFER decision.",
            null,
          ),
        ),
    });

    await expect(
      controller.resumeTask(
        "run-1",
        {
          resume: {
            findingIds: ["finding-1"],
          },
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_INVALID_RESUME",
        details: {},
        message: "Comment moderation resume payload requires APPROVE or DEFER decision.",
      },
    });
    await expect(
      controller.resumeTask(
        "run-1",
        {
          resume: {
            findingIds: ["finding-1"],
          },
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toSatisfy((error: unknown) => !JSON.stringify(error).includes("workflowName"));
    await expect(
      controller.resumeTask(
        "run-1",
        {
          resume: {
            findingIds: ["finding-1"],
          },
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("maps non-resumable registered tasks to a business validation response", async () => {
    const controller = createController({
      resumeRun: vi
        .fn()
        .mockRejectedValue(
          new AdminAgentWorkflowResumeUnsupportedError("run-1", "COMMENT_MODERATION_ANALYSIS"),
        ),
    });

    await expect(
      controller.resumeTask(
        "run-1",
        {
          resume: {
            decision: "APPROVE",
          },
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toMatchObject({
      response: {
        code: "ADMIN_AGENT_TASK_RESUME_UNSUPPORTED",
        details: {
          taskId: "run-1",
        },
        message: "Agent task does not support human approval resume.",
      },
    });
    await expect(
      controller.resumeTask(
        "run-1",
        {
          resume: {
            decision: "APPROVE",
          },
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("maps missing runs during resume to not found", async () => {
    const controller = createController({
      resumeRun: vi.fn().mockRejectedValue(new AdminAgentWorkflowNotFoundError("missing-run")),
    });

    await expect(
      controller.resumeTask(
        "missing-run",
        {
          resume: {
            decision: "APPROVE",
          },
        },
        createAdminUser(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

function createController(
  overrides: Record<string, unknown> = {},
  conversationMessages = { execute: vi.fn().mockResolvedValue([]) },
  moderateCommentAnalysis = { execute: vi.fn() },
  chatMessageRepository = { recordMessage: vi.fn() },
) {
  return new AdminAgentController(
    {} as never,
    {} as never,
    conversationMessages as never,
    {
      ...overrides,
    } as never,
    moderateCommentAnalysis as never,
    chatMessageRepository as never,
  );
}

function createAdminUser() {
  return {
    avatarUrl: null,
    email: "admin@example.com",
    id: "admin-1",
    login: "admin",
    name: "Admin",
    provider: "github",
    providerUserId: "github-1",
  } as never;
}

function createRequest() {
  return {
    get(header: string) {
      return header === "user-agent" ? "vitest" : undefined;
    },
    ip: "127.0.0.1",
  } as never;
}

function createRun(overrides: Record<string, unknown> = {}) {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-04T03:00:00.000Z"),
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
    startedByUserId: "admin-1",
    status: "PENDING",
    summary: null,
    threadId: "run-1",
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T03:00:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}
