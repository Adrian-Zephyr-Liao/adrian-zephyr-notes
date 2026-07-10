import { describe, expect, it, vi } from "vitest";
import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type { AdminAgentWorkflowActionExecution } from "../domain/admin-agent-workflow-action-execution.entity";
import type {
  AdminAgentWorkflowActionExecutionResult,
  AdminAgentWorkflowActionExecutor,
} from "../domain/admin-agent-workflow-action-executor";
import type { GenericApprovalResume } from "../domain/admin-agent-workflow-approval";
import { executeAdminAgentGenericApprovalAction } from "./execute-admin-agent-generic-approval-action";

describe("executeAdminAgentGenericApprovalAction", () => {
  it("does nothing for missing, rejected, or read-only approvals", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
    });
    const { actionExecutor, executeAction } = createActionExecutor();

    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: null,
        repository,
        runId: "run-1",
      }),
    ).resolves.toBeNull();
    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: createApproval({ decision: "reject" }),
        repository,
        runId: "run-1",
      }),
    ).resolves.toBeNull();
    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: createApproval({ action: "REVIEW_SITE_CONFIG" }),
        repository,
        runId: "run-1",
      }),
    ).resolves.toBeNull();

    expect(repository.ensureWorkflowActionExecution).not.toHaveBeenCalled();
    expect(executeAction).not.toHaveBeenCalled();
  });

  it("requires execution context for approved write actions", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
    });
    const { actionExecutor } = createActionExecutor();

    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: createApproval({ actor: undefined }),
        repository,
        runId: "run-1",
      }),
    ).rejects.toThrow("Admin agent approved action is missing execution context.");
  });

  it("reuses a succeeded action execution result", async () => {
    const result = createActionResult(["announcement-1"]);
    const repository = createRepository({
      execution: {
        claimStatus: "SUCCEEDED",
        execution: createExecution({ result, status: "SUCCEEDED" }),
      },
    });
    const { actionExecutor, executeAction } = createActionExecutor();

    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: createApproval(),
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual(result);

    expect(executeAction).not.toHaveBeenCalled();
    expect(repository.markWorkflowActionExecutionSucceeded).not.toHaveBeenCalled();
  });

  it("executes approved write actions and stores the result", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
    });
    const result = createActionResult(["announcement-1"]);
    const { actionExecutor, executeAction } = createActionExecutor(result);

    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: createApproval({
          payload: { text: "Hello" },
          requestContext: {
            ipAddress: "127.0.0.1",
            userAgent: "test",
          },
        }),
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual(result);

    expect(repository.ensureWorkflowActionExecution).toHaveBeenCalledWith({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      approvalId: "approval-1",
      payload: { text: "Hello" },
      runId: "run-1",
      subject: "SITE_CONFIG",
    });
    expect(executeAction).toHaveBeenCalledWith({
      action: "UPDATE_SITE_ANNOUNCEMENT",
      actor: createActor(),
      payload: { text: "Hello" },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "test",
      },
      subject: "SITE_CONFIG",
    });
    expect(repository.markWorkflowActionExecutionSucceeded).toHaveBeenCalledWith(
      "execution-1",
      result,
    );
  });

  it("reuses the stored result when an approved node replays after a successful write", async () => {
    const result = createActionResult(["announcement-1"]);
    let execution: Awaited<ReturnType<AdminAgentRepository["ensureWorkflowActionExecution"]>> = {
      claimStatus: "CLAIMED",
      execution: createExecution({ status: "RUNNING" }),
    };
    const repository = {
      ensureWorkflowActionExecution: vi.fn().mockImplementation(async () => execution),
      markWorkflowActionExecutionFailed: vi.fn(),
      markWorkflowActionExecutionSucceeded: vi
        .fn()
        .mockImplementation(async (_id, storedResult) => {
          const storedExecution = createExecution({
            result: storedResult,
            status: "SUCCEEDED",
          });
          execution = {
            claimStatus: "SUCCEEDED",
            execution: storedExecution,
          };
          return storedExecution;
        }),
    };
    const { actionExecutor, executeAction } = createActionExecutor(result);
    const approval = createApproval();

    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval,
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual(result);
    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval,
        repository,
        runId: "run-1",
      }),
    ).resolves.toEqual(result);

    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(repository.markWorkflowActionExecutionSucceeded).toHaveBeenCalledTimes(1);
  });

  it("marks the action execution failed before rethrowing executor errors", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "CLAIMED",
        execution: createExecution({ status: "RUNNING" }),
      },
    });
    const { actionExecutor, executeAction } = createActionExecutor();
    executeAction.mockRejectedValue(new Error("Site config update failed."));

    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: createApproval(),
        repository,
        runId: "run-1",
      }),
    ).rejects.toThrow("Site config update failed.");

    expect(repository.markWorkflowActionExecutionFailed).toHaveBeenCalledWith(
      "execution-1",
      "Site config update failed.",
    );
  });

  it("does not execute again when an approved write action is already running", async () => {
    const repository = createRepository({
      execution: {
        claimStatus: "IN_PROGRESS",
        execution: createExecution({ status: "RUNNING" }),
      },
    });
    const { actionExecutor, executeAction } = createActionExecutor();

    await expect(
      executeAdminAgentGenericApprovalAction({
        actionExecutor,
        approval: createApproval(),
        repository,
        runId: "run-1",
      }),
    ).rejects.toThrow("Admin agent workflow action execution is already in progress");

    expect(executeAction).not.toHaveBeenCalled();
    expect(repository.markWorkflowActionExecutionSucceeded).not.toHaveBeenCalled();
    expect(repository.markWorkflowActionExecutionFailed).not.toHaveBeenCalled();
  });
});

function createRepository(input: {
  execution: Awaited<ReturnType<AdminAgentRepository["ensureWorkflowActionExecution"]>>;
}): Pick<
  AdminAgentRepository,
  | "ensureWorkflowActionExecution"
  | "markWorkflowActionExecutionFailed"
  | "markWorkflowActionExecutionSucceeded"
> {
  return {
    ensureWorkflowActionExecution: vi.fn().mockResolvedValue(input.execution),
    markWorkflowActionExecutionFailed: vi.fn().mockResolvedValue(input.execution),
    markWorkflowActionExecutionSucceeded: vi.fn().mockResolvedValue(input.execution),
  };
}

function createActionExecutor(
  result: AdminAgentWorkflowActionExecutionResult = createActionResult(["announcement-1"]),
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

function createApproval(overrides: Partial<GenericApprovalResume> = {}): GenericApprovalResume {
  return {
    action: "UPDATE_SITE_ANNOUNCEMENT",
    actor: createActor(),
    approvalId: "approval-1",
    decision: "approve",
    payload: {},
    subject: "SITE_CONFIG",
    ...overrides,
  };
}

function createActor(): GenericApprovalResume["actor"] {
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
    action: "UPDATE_SITE_ANNOUNCEMENT",
    approvalId: "approval-1",
    createdAt: new Date("2026-07-09T00:00:00.000Z"),
    errorMessage: null,
    id: "execution-1",
    payload: {},
    result: null,
    runId: "run-1",
    status: "RUNNING",
    subject: "SITE_CONFIG",
    updatedAt: new Date("2026-07-09T00:00:00.000Z"),
    ...overrides,
  };
}
