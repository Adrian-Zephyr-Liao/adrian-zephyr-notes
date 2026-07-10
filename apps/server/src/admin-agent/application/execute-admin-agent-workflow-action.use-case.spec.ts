import { describe, expect, it, vi } from "vitest";
import type {
  AdminAgentWorkflowActionExecutionResult,
  AdminAgentWorkflowActionHandler,
} from "../domain/admin-agent-workflow-action-executor";
import { AdminAgentWorkflowActionUnsupportedError } from "../domain/admin-agent-workflow-action-executor";
import { ExecuteAdminAgentWorkflowActionUseCase } from "./execute-admin-agent-workflow-action.use-case";

describe("ExecuteAdminAgentWorkflowActionUseCase", () => {
  it("routes actions to the matching registered handler", async () => {
    const executionResult = {
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "announcement-1",
          status: "APPLIED",
        },
      ],
    } satisfies AdminAgentWorkflowActionExecutionResult;
    const handler = {
      actionKey: "SITE_CONFIG.UPDATE_SITE_ANNOUNCEMENT",
      execute: vi.fn(async () => executionResult),
    } satisfies AdminAgentWorkflowActionHandler;
    const useCase = new ExecuteAdminAgentWorkflowActionUseCase([handler]);
    const input = {
      action: "UPDATE_SITE_ANNOUNCEMENT",
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      payload: {
        announcementId: "announcement-1",
      },
      subject: "SITE_CONFIG" as const,
    };

    await expect(useCase.executeAction(input)).resolves.toEqual(executionResult);
    expect(handler.execute).toHaveBeenCalledWith(input);
  });

  it("rejects unsupported workflow actions explicitly", async () => {
    const useCase = new ExecuteAdminAgentWorkflowActionUseCase([]);

    await expect(
      useCase.executeAction({
        action: "PUBLISH_ARTICLE",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        payload: {
          articleId: "article-1",
        },
        subject: "ARTICLE",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowActionUnsupportedError);
  });
});
