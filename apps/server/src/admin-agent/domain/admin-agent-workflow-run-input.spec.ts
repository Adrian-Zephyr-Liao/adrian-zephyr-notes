import { describe, expect, it } from "vitest";
import type { AdminAgentRun } from "./admin-agent-run.entity";
import {
  createAdminAgentWorkflowBranchRunInput,
  createAdminAgentWorkflowRunInput,
  toAdminAgentWorkflowRetryInput,
} from "./admin-agent-workflow-run-input";

describe("createAdminAgentWorkflowRunInput", () => {
  const now = new Date("2026-07-09T03:00:00.000Z");

  it("creates durable run input with a uniform workflow envelope", () => {
    expect(
      createAdminAgentWorkflowRunInput(
        {
          dedupeKey: "dedupe-1",
          input: { scope: "today" },
          parentRunId: "parent-1",
          startedByUserId: "admin-1",
          startReason: "CHAT_INTENT",
          workflowName: "COMMENT_MODERATION_ANALYSIS",
        },
        { now, runId: "run-1" },
      ),
    ).toEqual({
      dedupeKey: "dedupe-1",
      id: "run-1",
      input: {
        requestedAt: "2026-07-09T03:00:00.000Z",
        startReason: "CHAT_INTENT",
        workflowInput: { scope: "today" },
      },
      metadata: {
        graph: "commentModerationWorkflow",
        requestedAt: "2026-07-09T03:00:00.000Z",
        startReason: "CHAT_INTENT",
      },
      parentRunId: "parent-1",
      parentRunRelation: "CHILD_TASK",
      startedByUserId: "admin-1",
      threadId: "run-1",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
  });

  it("uses the same durable run input envelope for every workflow", () => {
    expect(
      createAdminAgentWorkflowRunInput(
        {
          input: { articleId: "article-1" },
          startedByUserId: null,
          workflowName: "ARTICLE_ASSISTANCE",
        },
        { now, runId: "run-2" },
      ),
    ).toEqual({
      dedupeKey: null,
      id: "run-2",
      input: {
        requestedAt: "2026-07-09T03:00:00.000Z",
        startReason: "MANUAL",
        workflowInput: { articleId: "article-1" },
      },
      metadata: {
        graph: "articleAssistanceWorkflow",
        requestedAt: "2026-07-09T03:00:00.000Z",
        startReason: "MANUAL",
      },
      parentRunId: null,
      parentRunRelation: null,
      startedByUserId: null,
      threadId: "run-2",
      type: "ARTICLE_ASSISTANCE",
      workflowName: "ARTICLE_ASSISTANCE",
    });
  });

  it("keeps site, audit, and multi-task run metadata catalog-driven", () => {
    expect(
      ["SITE_CONFIG_REVIEW", "AUDIT_REVIEW", "MULTI_TASK_ORCHESTRATION"].map((workflowName) =>
        createAdminAgentWorkflowRunInput(
          {
            startedByUserId: "admin-1",
            workflowName: workflowName as
              | "AUDIT_REVIEW"
              | "MULTI_TASK_ORCHESTRATION"
              | "SITE_CONFIG_REVIEW",
          },
          { now, runId: `run-${workflowName}` },
        ),
      ),
    ).toMatchObject([
      {
        metadata: { graph: "siteConfigReviewWorkflow" },
        type: "SITE_CONFIG_REVIEW",
        workflowName: "SITE_CONFIG_REVIEW",
      },
      {
        metadata: { graph: "auditReviewWorkflow" },
        type: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      },
      {
        metadata: { graph: "multiTaskOrchestrationWorkflow" },
        type: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
    ]);
  });

  it("marks retried runs with an explicit parent relation", () => {
    expect(
      createAdminAgentWorkflowRunInput(
        {
          input: { articleId: "article-1" },
          parentRunId: "failed-run",
          startedByUserId: "admin-1",
          startReason: "RETRY",
          workflowName: "ARTICLE_ASSISTANCE",
        },
        { now, runId: "retry-run" },
      ),
    ).toMatchObject({
      metadata: {
        startReason: "RETRY",
      },
      parentRunId: "failed-run",
      parentRunRelation: "RETRY",
      threadId: "retry-run",
    });
  });
});

describe("createAdminAgentWorkflowBranchRunInput", () => {
  const now = new Date("2026-07-09T04:30:00.000Z");

  it("creates a durable branch run from the source workflow run", () => {
    expect(
      createAdminAgentWorkflowBranchRunInput(
        {
          sourceRun: createRun({
            input: { scope: "recent" },
            metadata: {
              graph: "commentModerationWorkflow",
              startReason: "CHAT_INTENT",
            },
          }),
          sourceThreadId: "thread-source",
          startedByUserId: "admin-2",
        },
        { now, runId: "branch-run-1" },
      ),
    ).toEqual({
      dedupeKey: null,
      id: "branch-run-1",
      input: {
        branchedFromRunId: "source-run",
        branchedFromThreadId: "thread-source",
        scope: "recent",
      },
      metadata: {
        branchedAt: "2026-07-09T04:30:00.000Z",
        branchedFromRunId: "source-run",
        branchedFromThreadId: "thread-source",
        graph: "commentModerationWorkflow",
        graphBranch: true,
        startReason: "BRANCH",
      },
      parentRunId: "source-run",
      parentRunRelation: "BRANCH",
      startedByUserId: "admin-2",
      threadId: "branch-run-1",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
  });

  it("handles source runs without metadata", () => {
    expect(
      createAdminAgentWorkflowBranchRunInput(
        {
          sourceRun: createRun({ metadata: null }),
          sourceThreadId: "thread-source",
          startedByUserId: null,
        },
        { now, runId: "branch-run-2" },
      ).metadata,
    ).toEqual({
      branchedAt: "2026-07-09T04:30:00.000Z",
      branchedFromRunId: "source-run",
      branchedFromThreadId: "thread-source",
      graphBranch: true,
      startReason: "BRANCH",
    });
  });
});

describe("toAdminAgentWorkflowRetryInput", () => {
  it("unwraps workflow input from the durable run envelope", () => {
    expect(
      toAdminAgentWorkflowRetryInput(
        createRun({
          input: {
            requestedAt: "2026-07-09T04:00:00.000Z",
            startReason: "CHAT_INTENT",
            workflowInput: { scope: "today" },
          },
          workflowName: "COMMENT_MODERATION_ANALYSIS",
        }),
      ),
    ).toEqual({ scope: "today" });
  });

  it("does not recover retry input from non-envelope run data", () => {
    expect(
      toAdminAgentWorkflowRetryInput(
        createRun({
          input: { articleId: "article-1" },
          type: "ARTICLE_ASSISTANCE",
          workflowName: "ARTICLE_ASSISTANCE",
        }),
      ),
    ).toBeNull();
  });
});

function createRun(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
  return {
    attemptCount: 1,
    createdAt: new Date("2026-07-09T04:00:00.000Z"),
    currentNode: null,
    dedupeKey: "source-dedupe",
    errorMessage: null,
    id: "source-run",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: "admin-1",
    status: "WAITING_FOR_APPROVAL",
    summary: null,
    threadId: "thread-source",
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-09T04:00:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}
