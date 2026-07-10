// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type {
  AdminOperationLogAction,
  AdminOperationLogListResponse,
} from "@adrian-zephyr-notes/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogManagement } from "./audit-log-management";

const adminApiMocks = vi.hoisted(() => ({
  listAdminOperationLogs: vi.fn(),
}));

vi.mock("../../lib/admin-api", () => ({
  listAdminOperationLogs: adminApiMocks.listAdminOperationLogs,
}));

describe("AuditLogManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApiMocks.listAdminOperationLogs.mockResolvedValue(createAuditLogResponse());
  });

  afterEach(() => {
    cleanup();
  });

  it("presents audit records as business activity without internal orchestration details", async () => {
    render(<AuditLogManagement />);

    expect(await screen.findByText("管理员已批准屏蔽 Agent 建议")).not.toBeNull();
    expect(screen.getByText("确认评论治理分析")).not.toBeNull();
    expect(screen.getByText("Agent 确认")).not.toBeNull();
    expect(screen.getByText("评论已设为已隐藏")).not.toBeNull();
    expect(screen.getByText("同步审计投影")).not.toBeNull();
    expect(screen.getByText("建议编号")).not.toBeNull();
    expect(screen.getByText("84fdd3a4...")).not.toBeNull();

    await waitFor(() => {
      expect(adminApiMocks.listAdminOperationLogs).toHaveBeenCalledWith({
        action: "ALL",
        page: 1,
        pageSize: 10,
      });
    });

    expect(document.body.textContent).not.toMatch(
      /LangGraph|agent\/runs|checkpoint|comment_moderation_analysis|debug|runtime|threadId|workflowName|workflowRunId|任务控制|任务继续|任务启动|运行面板|运行态|运行时/,
    );
  });
});

function createAuditLogResponse(): AdminOperationLogListResponse {
  return {
    data: [
      {
        action: "ADMIN_AGENT_FINDING_DECIDED",
        actorLogin: "Adrian-Zephyr-Liao",
        createdAt: "2026-07-07T15:55:00.000Z",
        id: "audit-1",
        ipAddress: "::ffff:127.0.0.1",
        metadata: {
          agentFindingId: "84fdd3a4-2cec-47f8-9cc1-d2dff02debdd",
          checkpointId: "checkpoint-1",
          decision: "EXECUTE_PROPOSED_ACTION",
          source: "admin_agent",
          threadId: "thread-1",
          workflowName: "COMMENT_MODERATION_ANALYSIS",
          workflowRunId: "workflow-run-1",
        },
        resourceId: "77649607-fadb-4d24-b5f4-bca8ae2ce7d7",
        resourceType: "article_comment",
        summary: "Approved admin agent finding.",
        userAgent: "curl/8.0.0",
      },
      {
        action: "ADMIN_AGENT_TASK_RESUMED",
        actorLogin: "Adrian-Zephyr-Liao",
        createdAt: "2026-07-07T15:55:00.500Z",
        id: "audit-task-resumed",
        ipAddress: "::ffff:127.0.0.1",
        metadata: {
          decision: "APPROVE",
          status: "COMPLETED",
          taskTitle: "评论治理分析",
          taskName: "comment_moderation_analysis",
          threadId: "thread-1",
          workflowName: "COMMENT_MODERATION_ANALYSIS",
        },
        resourceId: "run-1",
        resourceType: "ADMIN_AGENT_TASK",
        summary: "恢复 Agent 业务处理 comment_moderation_analysis",
        userAgent: "curl/8.0.0",
      },
      {
        action: "COMMENT_STATUS_UPDATED",
        actorLogin: "Adrian-Zephyr-Liao",
        createdAt: "2026-07-07T15:55:01.000Z",
        id: "audit-2",
        ipAddress: "::ffff:127.0.0.1",
        metadata: {
          source: "admin_agent",
          status: "HIDDEN",
        },
        resourceId: "77649607-fadb-4d24-b5f4-bca8ae2ce7d7",
        resourceType: "article_comment",
        summary: "Updated article comment status to HIDDEN",
        userAgent: "curl/8.0.0",
      },
      {
        action: "UNKNOWN_ADMIN_ACTION" as AdminOperationLogAction,
        actorLogin: "Adrian-Zephyr-Liao",
        createdAt: "2026-07-07T15:55:02.000Z",
        id: "audit-3",
        ipAddress: "::ffff:127.0.0.1",
        metadata: null,
        resourceId: "internal-1",
        resourceType: "article_comment",
        summary: "同步审计投影",
        userAgent: "curl/8.0.0",
      },
    ],
    pagination: {
      page: 1,
      pageSize: 10,
      totalItems: 2,
      totalPages: 1,
    },
  };
}
