import { describe, expect, it, vi } from "vitest";
import type { DecideAdminAgentFindingsUseCase } from "./decide-admin-agent-findings.use-case";
import { AdminAgentWorkflowActionValidationError } from "../domain/admin-agent-workflow-action-executor";
import { CommentModerationAgentActionHandler } from "./comment-moderation-agent-action.handler";

describe("CommentModerationAgentActionHandler", () => {
  it("executes comment hide actions through the finding decision batch use case", async () => {
    const decideFindings = {
      execute: vi.fn(async () => ({
        results: [
          {
            decision: "EXECUTE_PROPOSED_ACTION",
            findingId: "finding-1",
            result: {
              finding: {
                id: "finding-1",
                targetId: "comment-1",
              },
              updatedComment: {
                id: "comment-1",
                status: "HIDDEN",
              },
            },
            status: "APPLIED",
          },
          {
            decision: "EXECUTE_PROPOSED_ACTION",
            error: {
              code: "CommentAlreadyHidden",
              message: "Comment already hidden.",
            },
            findingId: "finding-2",
            status: "FAILED",
          },
        ],
      })),
    } as unknown as DecideAdminAgentFindingsUseCase & {
      execute: ReturnType<typeof vi.fn>;
    };
    const handler = new CommentModerationAgentActionHandler(decideFindings);

    await expect(
      handler.execute({
        action: "HIDE_COMMENT",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        payload: {
          findingIds: ["finding-1", "finding-2"],
        },
        subject: "ARTICLE_COMMENT",
      }),
    ).resolves.toEqual({
      appliedCount: 1,
      failedCount: 1,
      results: [
        {
          resourceId: "comment-1",
          status: "APPLIED",
          summary: "评论已屏蔽。",
        },
        {
          error: {
            code: "CommentAlreadyHidden",
            message: "Comment already hidden.",
          },
          resourceId: "finding-2",
          status: "FAILED",
        },
      ],
    });
    expect(decideFindings.execute).toHaveBeenCalledWith({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      decisions: [
        {
          decision: "EXECUTE_PROPOSED_ACTION",
          findingId: "finding-1",
        },
        {
          decision: "EXECUTE_PROPOSED_ACTION",
          findingId: "finding-2",
        },
      ],
      requestContext: undefined,
    });
  });

  it("falls back to the finding target id when the comment update result is unavailable", async () => {
    const decideFindings = {
      execute: vi.fn(async () => ({
        results: [
          {
            decision: "EXECUTE_PROPOSED_ACTION",
            findingId: "finding-1",
            result: {
              finding: {
                id: "finding-1",
                targetId: "comment-1",
              },
              updatedComment: null,
            },
            status: "APPLIED",
          },
        ],
      })),
    } as unknown as DecideAdminAgentFindingsUseCase & {
      execute: ReturnType<typeof vi.fn>;
    };
    const handler = new CommentModerationAgentActionHandler(decideFindings);

    await expect(
      handler.execute({
        action: "HIDE_COMMENT",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        payload: {
          findingIds: ["finding-1"],
        },
        subject: "ARTICLE_COMMENT",
      }),
    ).resolves.toEqual({
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "comment-1",
          status: "APPLIED",
          summary: "评论治理建议已执行。",
        },
      ],
    });
  });

  it("validates required finding ids at the action boundary", async () => {
    const handler = new CommentModerationAgentActionHandler({
      execute: vi.fn(),
    } as unknown as DecideAdminAgentFindingsUseCase);

    await expect(
      handler.execute({
        action: "HIDE_COMMENT",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        payload: {},
        subject: "ARTICLE_COMMENT",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowActionValidationError);
  });
});
