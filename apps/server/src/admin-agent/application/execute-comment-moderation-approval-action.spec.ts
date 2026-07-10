import { describe, expect, it, vi } from "vitest";
import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type { AdminAgentFinding } from "../domain/admin-agent-finding.entity";
import type { AdminAgentWorkflowActionExecution } from "../domain/admin-agent-workflow-action-execution.entity";
import type {
  AdminAgentWorkflowActionExecutionResult,
  AdminAgentWorkflowActionExecutor,
} from "../domain/admin-agent-workflow-action-executor";
import type { CommentModerationApprovalResume } from "../domain/admin-agent-workflow-approval";
import { executeCommentModerationApprovalAction } from "./execute-comment-moderation-approval-action";

describe("executeCommentModerationApprovalAction", () => {
  it("reuses a succeeded action execution result", async () => {
    const result = createActionResult(["comment-1"]);
    const repository = createRepository({
      execution: {
        claimStatus: "SUCCEEDED",
        execution: createExecution({ result, status: "SUCCEEDED" }),
      },
    });
    const { actionExecutor, executeAction } = createActionExecutor();

    await expect(
      executeCommentModerationApprovalAction({
        actionExecutor,
        approval: createApproval(["finding-1"]),
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual(result);

    expect(repository.listFindingsByIds).not.toHaveBeenCalled();
    expect(executeAction).not.toHaveBeenCalled();
  });

  it("executes only currently pending hide-comment findings and stores the result", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
      findings: [
        createFinding({ id: "finding-1", proposedAction: "HIDE_COMMENT", status: "PENDING" }),
        createFinding({ id: "finding-2", proposedAction: "NO_ACTION", status: "PENDING" }),
        createFinding({ id: "finding-3", proposedAction: "HIDE_COMMENT", status: "EXECUTED" }),
      ],
    });
    const result = createActionResult(["comment-1"]);
    const { actionExecutor, executeAction } = createActionExecutor(result);

    await expect(
      executeCommentModerationApprovalAction({
        actionExecutor,
        approval: createApproval(["finding-1", "finding-1", "finding-2", "finding-3"]),
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual(result);

    expect(repository.ensureWorkflowActionExecution).toHaveBeenCalledWith({
      action: "HIDE_COMMENT",
      approvalId: "comment-moderation:run-1",
      payload: {
        findingIds: ["finding-1", "finding-2", "finding-3"],
      },
      runId: "run-1",
      subject: "ARTICLE_COMMENT",
    });
    expect(executeAction).toHaveBeenCalledWith({
      action: "HIDE_COMMENT",
      actor: createActor(),
      payload: {
        findingIds: ["finding-1"],
      },
      requestContext: undefined,
      subject: "ARTICLE_COMMENT",
    });
    expect(repository.markWorkflowActionExecutionSucceeded).toHaveBeenCalledWith(
      "execution-1",
      result,
    );
  });

  it("stores an empty successful execution when no finding remains executable", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
      findings: [
        createFinding({ id: "finding-1", proposedAction: "NO_ACTION", status: "PENDING" }),
      ],
    });
    const { actionExecutor, executeAction } = createActionExecutor();

    await expect(
      executeCommentModerationApprovalAction({
        actionExecutor,
        approval: createApproval(["finding-1"]),
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual({
      appliedCount: 0,
      failedCount: 0,
      results: [],
    });

    expect(executeAction).not.toHaveBeenCalled();
    expect(repository.markWorkflowActionExecutionSucceeded).toHaveBeenCalledWith("execution-1", {
      appliedCount: 0,
      failedCount: 0,
      results: [],
    });
  });

  it("recovers successful action results from already executed findings after resume replay", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
      findings: [
        createFinding({
          id: "finding-1",
          proposedAction: "HIDE_COMMENT",
          status: "EXECUTED",
          target: createFindingTarget({ id: "comment-1", status: "HIDDEN" }),
        }),
      ],
    });
    const { actionExecutor, executeAction } = createActionExecutor();

    await expect(
      executeCommentModerationApprovalAction({
        actionExecutor,
        approval: createApproval(["finding-1"]),
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual({
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "comment-1",
          status: "APPLIED",
          summary: "评论已屏蔽。",
        },
      ],
    });

    expect(executeAction).not.toHaveBeenCalled();
    expect(repository.markWorkflowActionExecutionSucceeded).toHaveBeenCalledWith("execution-1", {
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "comment-1",
          status: "APPLIED",
          summary: "评论已屏蔽。",
        },
      ],
    });
  });

  it("marks the action execution failed before rethrowing executor errors", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
      findings: [
        createFinding({ id: "finding-1", proposedAction: "HIDE_COMMENT", status: "PENDING" }),
      ],
    });
    const { actionExecutor, executeAction } = createActionExecutor();
    executeAction.mockRejectedValue(new Error("Admin API request failed."));

    await expect(
      executeCommentModerationApprovalAction({
        actionExecutor,
        approval: createApproval(["finding-1"]),
        repository,
        runId: "run-1",
      }),
    ).rejects.toThrow("Admin API request failed.");

    expect(repository.markWorkflowActionExecutionFailed).toHaveBeenCalledWith(
      "execution-1",
      "Admin API request failed.",
    );
  });

  it("does not execute again when the approval action is already running", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "IN_PROGRESS",
        execution: createExecution({ status: "RUNNING" }),
      },
    });
    const { actionExecutor, executeAction } = createActionExecutor();

    await expect(
      executeCommentModerationApprovalAction({
        actionExecutor,
        approval: createApproval(["finding-1"]),
        repository,
        runId: "run-1",
      }),
    ).rejects.toThrow("Admin agent workflow action execution is already in progress");

    expect(repository.listFindingsByIds).not.toHaveBeenCalled();
    expect(executeAction).not.toHaveBeenCalled();
    expect(repository.markWorkflowActionExecutionSucceeded).not.toHaveBeenCalled();
    expect(repository.markWorkflowActionExecutionFailed).not.toHaveBeenCalled();
  });
});

function createRepository(input: {
  execution: Awaited<ReturnType<AdminAgentRepository["ensureWorkflowActionExecution"]>>;
  findings?: AdminAgentFinding[];
}): Pick<
  AdminAgentRepository,
  | "ensureWorkflowActionExecution"
  | "listFindingsByIds"
  | "markWorkflowActionExecutionFailed"
  | "markWorkflowActionExecutionSucceeded"
> {
  return {
    ensureWorkflowActionExecution: vi.fn().mockResolvedValue(input.execution),
    listFindingsByIds: vi.fn().mockResolvedValue(input.findings ?? []),
    markWorkflowActionExecutionFailed: vi.fn().mockResolvedValue(input.execution),
    markWorkflowActionExecutionSucceeded: vi.fn().mockResolvedValue(input.execution),
  };
}

function createActionExecutor(
  result: AdminAgentWorkflowActionExecutionResult = createActionResult(["comment-1"]),
): {
  actionExecutor: AdminAgentWorkflowActionExecutor;
  executeAction: ReturnType<typeof vi.fn>;
} {
  const executeAction = vi.fn().mockResolvedValue(result);

  return {
    actionExecutor: {
      executeAction,
    },
    executeAction,
  };
}

function createApproval(findingIds: string[]): CommentModerationApprovalResume {
  return {
    actor: createActor(),
    decision: "APPROVE",
    findingIds,
  };
}

function createActor(): CommentModerationApprovalResume["actor"] {
  return {
    id: "user-1",
    login: "admin",
  };
}

function createActionResult(resourceIds: string[]): AdminAgentWorkflowActionExecutionResult {
  return {
    appliedCount: resourceIds.length,
    failedCount: 0,
    results: resourceIds.map((resourceId) => ({
      resourceId,
      status: "APPLIED",
    })),
  };
}

function createExecution(
  overrides: Partial<AdminAgentWorkflowActionExecution>,
): AdminAgentWorkflowActionExecution {
  return {
    action: "HIDE_COMMENT",
    approvalId: "comment-moderation:run-1",
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    errorMessage: null,
    id: "execution-1",
    payload: {},
    result: null,
    runId: "run-1",
    status: "RUNNING",
    subject: "ARTICLE_COMMENT",
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
    ...overrides,
  };
}

function createFinding(overrides: Partial<AdminAgentFinding>): AdminAgentFinding {
  return {
    category: "OTHER",
    confidence: 0.9,
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    evidence: [],
    executedAt: null,
    id: "finding-1",
    proposedAction: "HIDE_COMMENT",
    reason: "test",
    runId: "run-1",
    severity: "HIGH",
    status: "PENDING",
    target: null,
    targetId: "comment-1",
    targetType: "ARTICLE_COMMENT",
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
    ...overrides,
  };
}

function createFindingTarget(
  overrides: Partial<NonNullable<AdminAgentFinding["target"]>> = {},
): NonNullable<AdminAgentFinding["target"]> {
  return {
    article: {
      id: "article-1",
      slug: "article",
      title: "Article",
    },
    author: {
      avatarUrl: null,
      id: "author-1",
      login: "author",
      name: null,
      profileUrl: "https://github.com/author",
    },
    body: "comment",
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    id: "comment-1",
    parent: null,
    status: "VISIBLE",
    ...overrides,
  };
}
