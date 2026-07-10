import { describe, expect, it } from "vitest";
import {
  assertAdminAgentWorkflowActionExecutionMatchesInput,
  adminAgentWorkflowActionExecutionLeaseMs,
  isAdminAgentWorkflowActionExecutionInProgress,
} from "./admin-agent-workflow-action-execution.entity";

describe("isAdminAgentWorkflowActionExecutionInProgress", () => {
  it("keeps a fresh clean running execution locked", () => {
    expect(
      isAdminAgentWorkflowActionExecutionInProgress(
        {
          errorMessage: null,
          result: null,
          status: "RUNNING",
          updatedAt: new Date("2026-07-04T10:00:00.000Z"),
        },
        new Date("2026-07-04T10:00:30.000Z"),
      ),
    ).toBe(true);
  });

  it("allows stale clean running executions to be reclaimed after the lease expires", () => {
    expect(
      isAdminAgentWorkflowActionExecutionInProgress(
        {
          errorMessage: null,
          result: null,
          status: "RUNNING",
          updatedAt: new Date("2026-07-04T10:00:00.000Z"),
        },
        new Date(
          standardTime("2026-07-04T10:00:00.000Z") + adminAgentWorkflowActionExecutionLeaseMs,
        ),
      ),
    ).toBe(false);
  });

  it("does not treat failed or completed executions as active claims", () => {
    const now = new Date("2026-07-04T10:01:00.000Z");

    expect(
      isAdminAgentWorkflowActionExecutionInProgress(
        {
          errorMessage: "Admin API request failed.",
          result: null,
          status: "RUNNING",
          updatedAt: now,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isAdminAgentWorkflowActionExecutionInProgress(
        {
          errorMessage: null,
          result: { appliedCount: 1, failedCount: 0, results: [] },
          status: "SUCCEEDED",
          updatedAt: now,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe("assertAdminAgentWorkflowActionExecutionMatchesInput", () => {
  it("allows idempotent replays when the approved action payload is equivalent", () => {
    expect(() =>
      assertAdminAgentWorkflowActionExecutionMatchesInput(
        {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          approvalId: "approval-1",
          payload: {
            announcement: {
              body: "Hello",
              title: "Notice",
            },
            announcementId: "announcement-1",
          },
          subject: "SITE_CONFIG",
        },
        {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          approvalId: "approval-1",
          payload: {
            announcementId: "announcement-1",
            announcement: {
              title: "Notice",
              body: "Hello",
            },
          },
          runId: "run-1",
          subject: "SITE_CONFIG",
        },
      ),
    ).not.toThrow();
  });

  it("rejects reusing an approval id for a different write payload", () => {
    expect(() =>
      assertAdminAgentWorkflowActionExecutionMatchesInput(
        {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          approvalId: "approval-1",
          payload: { announcementId: "announcement-1" },
          subject: "SITE_CONFIG",
        },
        {
          action: "UPDATE_SITE_ANNOUNCEMENT",
          approvalId: "approval-1",
          payload: { announcementId: "announcement-2" },
          runId: "run-1",
          subject: "SITE_CONFIG",
        },
      ),
    ).toThrow("Admin agent workflow action execution payload mismatch for approval: approval-1");
  });
});

function standardTime(value: string) {
  return new Date(value).getTime();
}
