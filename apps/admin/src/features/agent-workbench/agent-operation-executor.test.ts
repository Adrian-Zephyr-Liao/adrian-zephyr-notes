// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeAgentOperations } from "./agent-operation-executor";

const adminApiMocks = vi.hoisted(() => ({
  resumeAdminAgentTask: vi.fn(),
}));

vi.mock("../../lib/admin-api", () => ({
  resumeAdminAgentTask: adminApiMocks.resumeAdminAgentTask,
}));

describe("agent operation executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resumes backend Agent tasks through the task resume API", async () => {
    adminApiMocks.resumeAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {
        actionResult: {
          appliedCount: 1,
          failedCount: 0,
          results: [
            {
              resourceId: "finding-1",
              status: "APPLIED",
              summary: "评论已屏蔽。",
            },
          ],
        },
        findingCount: 1,
        scope: "today",
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-1",
        parentTaskId: null,
        status: "COMPLETED",
        summary: "done",
        updatedAt: "2026-07-04T05:00:00.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "done",
    });

    await expect(
      executeAgentOperations([
        {
          resume: {
            decision: "APPROVE",
            findingIds: ["finding-1"],
          },
          taskId: "run-1",
          type: "agent_task_resume",
        },
      ]),
    ).resolves.toEqual([
      {
        appliedAction: "hide",
        findingId: "finding-1",
        reason: "评论已屏蔽。",
        requestedAction: "hide",
        taskStatus: "COMPLETED",
      },
    ]);
    expect(adminApiMocks.resumeAdminAgentTask).toHaveBeenCalledWith("run-1", {
      resume: {
        decision: "APPROVE",
        findingIds: ["finding-1"],
      },
    });
  });

  it("represents non-comment task resume as a generic resume result", async () => {
    adminApiMocks.resumeAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {
        actionResult: {
          appliedCount: 1,
          failedCount: 0,
          results: [
            {
              resourceId: "announcement-1",
              status: "APPLIED",
            },
          ],
        },
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-site",
        parentTaskId: null,
        status: "COMPLETED",
        summary: "done",
        updatedAt: "2026-07-04T05:00:00.000Z",
        taskName: "site_config_review",
      },
      summary: "done",
    });

    await expect(
      executeAgentOperations([
        {
          resume: {
            action: "UPDATE_SITE_CONFIG",
            approvalId: "site:run-site",
            decision: "approve",
            payload: {
              section: "navigation",
            },
            subject: "SITE_CONFIG",
          },
          taskId: "run-site",
          type: "agent_task_resume",
        },
      ]),
    ).resolves.toEqual([
      {
        appliedAction: "resume",
        findingId: "announcement-1",
        requestedAction: "resume",
        taskStatus: "COMPLETED",
      },
    ]);
  });

  it("does not execute malformed task resume operations", async () => {
    await expect(
      executeAgentOperations([
        {
          taskId: "run-1",
          type: "agent_task_resume",
        } as never,
      ]),
    ).resolves.toEqual([]);

    expect(adminApiMocks.resumeAdminAgentTask).not.toHaveBeenCalled();
  });
});
