import { describe, expect, it, vi } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import { RegisteredAdminAgentWorkflowRegistry } from "./admin-agent-workflow-registry";
import { ManageAdminAgentWorkflowsUseCase } from "./manage-admin-agent-workflows.use-case";
import { LangGraphAdminAgentWorkflowRunner } from "../infrastructure/langgraph-admin-agent-workflow.runner";
import {
  RecordingAdminAgentRepository,
  RecordingAdminAgentWorkflowActionExecutor,
  createChatCompletionClientDouble,
  createComment,
  createConfigServiceDouble,
} from "../testing/admin-agent-workflow-test-doubles";

describe("admin agent workflow control integration", () => {
  it("orchestrates comment moderation start, branch, resume and retry without exposing internal orchestration details", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "你是不是脑残，全家死光")],
    });
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor({
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
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        findings: [
          {
            category: "ABUSE",
            confidence: 0.92,
            evidence: ["脑残", "全家死光"],
            proposedAction: "HIDE_COMMENT",
            reason: "评论包含人身攻击和恶意诅咒。",
            severity: "HIGH",
            targetId: "comment-1",
          },
        ],
        summary: "LLM 识别出 1 条高风险评论。",
      }),
    );
    const { useCase } = createWorkflowControlHarness({
      actionExecutor,
      llm,
      repository,
    });

    const started = await useCase.startWorkflow({
      input: {
        scope: "today",
      },
      startedByUserId: "admin-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(started).toMatchObject({
      interruption: {
        action: "HIDE_COMMENT",
        findingIds: ["finding-1"],
        kind: "COMMENT_MODERATION_APPROVAL",
        subject: "ARTICLE_COMMENT",
      },
      run: {
        parentRunId: null,
        parentRunRelation: null,
        status: "WAITING_FOR_APPROVAL",
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
      summary: "LLM 识别出 1 条高风险评论。",
    });
    expect(repository.createdRuns[0]).toMatchObject({
      input: {
        requestedAt: expect.any(String),
        startReason: "MANUAL",
        workflowInput: {
          scope: "today",
        },
      },
      metadata: {
        graph: "commentModerationWorkflow",
        requestedAt: expect.any(String),
        startReason: "MANUAL",
      },
    });

    const branch = await useCase.controlRun({
      action: "branch",
      runId: started.run.id,
      startedByUserId: "admin-2",
    });

    expect(branch).toMatchObject({
      interruption: {
        approvalId: `comment-moderation:${branch.run.id}`,
        findingIds: ["finding-1"],
        kind: "COMMENT_MODERATION_APPROVAL",
      },
      run: {
        parentRunId: started.run.id,
        parentRunRelation: "BRANCH",
        status: "WAITING_FOR_APPROVAL",
        threadId: branch.run.id,
      },
    });
    await expect(repository.findRunById(started.run.id)).resolves.toMatchObject({
      status: "WAITING_FOR_APPROVAL",
    });

    if (branch.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    const resumedBranch = await useCase.resumeRun({
      actor: {
        id: "admin-3",
        login: "adrian",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      resume: {
        decision: "APPROVE",
        findingIds: branch.interruption.findingIds,
      },
      runId: branch.run.id,
    });
    expect(resumedBranch).toMatchObject({
      interruption: null,
      run: {
        id: branch.run.id,
        parentRunId: started.run.id,
        parentRunRelation: "BRANCH",
        status: "COMPLETED",
      },
    });
    expect(actionExecutor.calls).toEqual([
      expect.objectContaining({
        action: "HIDE_COMMENT",
        findingIds: ["finding-1"],
        subject: "ARTICLE_COMMENT",
      }),
    ]);
    expect(repository.listWorkflowActionExecutions()).toEqual([
      expect.objectContaining({
        action: "HIDE_COMMENT",
        result: expect.objectContaining({
          appliedCount: 1,
          failedCount: 0,
        }),
        status: "SUCCEEDED",
      }),
    ]);

    const retry = await useCase.controlRun({
      action: "retry",
      runId: resumedBranch.run.id,
      startedByUserId: "admin-4",
    });

    expect(retry).toMatchObject({
      interruption: {
        kind: "COMMENT_MODERATION_APPROVAL",
      },
      run: {
        parentRunId: resumedBranch.run.id,
        parentRunRelation: "RETRY",
        status: "WAITING_FOR_APPROVAL",
        threadId: retry.run.id,
      },
    });
    expect(repository.createdRuns.at(-1)).toMatchObject({
      input: {
        startReason: "RETRY",
      },
      metadata: {
        graph: "commentModerationWorkflow",
        startReason: "RETRY",
      },
      parentRunId: resumedBranch.run.id,
      parentRunRelation: "RETRY",
    });
  });

  it("orchestrates multi-task plan approval through branch and resume before starting child workflows", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "你是不是脑残，全家死光")],
    });
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        findings: [
          {
            category: "ABUSE",
            confidence: 0.92,
            evidence: ["脑残"],
            proposedAction: "HIDE_COMMENT",
            reason: "评论包含人身攻击。",
            severity: "HIGH",
            targetId: "comment-1",
          },
        ],
        summary: "LLM 识别出 1 条高风险评论。",
      }),
    );
    const { useCase } = createWorkflowControlHarness({
      llm,
      repository,
    });

    const started = await useCase.startWorkflow({
      input: {
        approvalMode: "required",
        tasks: [
          {
            input: {
              scope: "today",
            },
            reason: "检查今日评论风险。",
            taskName: "comment_moderation_analysis",
          },
        ],
      },
      startedByUserId: "admin-1",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });

    expect(started).toMatchObject({
      interruption: {
        action: "APPROVE_MULTI_TASK_PLAN",
        kind: "ADMIN_AGENT_APPROVAL",
        payload: {
          plan: [
            expect.objectContaining({
              workflowName: "COMMENT_MODERATION_ANALYSIS",
            }),
          ],
        },
        subject: "MULTI_TASK",
      },
      run: {
        status: "WAITING_FOR_APPROVAL",
        type: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
    });
    expect(repository.createdRuns).toHaveLength(1);

    const branch = await useCase.controlRun({
      action: "branch",
      runId: started.run.id,
      startedByUserId: "admin-2",
    });

    expect(branch).toMatchObject({
      interruption: {
        action: "APPROVE_MULTI_TASK_PLAN",
        approvalId: `approve_multi_task_plan:${branch.run.id}`,
        kind: "ADMIN_AGENT_APPROVAL",
      },
      run: {
        parentRunId: started.run.id,
        status: "WAITING_FOR_APPROVAL",
        threadId: branch.run.id,
      },
    });
    await expect(repository.findRunById(started.run.id)).resolves.toMatchObject({
      status: "WAITING_FOR_APPROVAL",
    });

    if (branch.interruption?.kind !== "ADMIN_AGENT_APPROVAL") {
      throw new Error("Expected generic multi-task approval interruption.");
    }

    const resumedBranch = await useCase.resumeRun({
      actor: {
        id: "admin-3",
        login: "adrian",
      },
      resume: {
        action: branch.interruption.action,
        approvalId: branch.interruption.approvalId,
        decision: "approve",
        payload: branch.interruption.payload,
        subject: branch.interruption.subject,
      },
      runId: branch.run.id,
    });

    expect(resumedBranch).toMatchObject({
      interruption: null,
      output: {
        childResults: [
          {
            interruptionKind: "COMMENT_MODERATION_APPROVAL",
            status: "WAITING_FOR_APPROVAL",
            workflowName: "COMMENT_MODERATION_ANALYSIS",
          },
        ],
        plannedTaskCount: 1,
      },
      run: {
        id: branch.run.id,
        parentRunId: started.run.id,
        status: "COMPLETED",
      },
      summary: expect.stringContaining("等待确认 1 个"),
    });
    expect(repository.createdRuns).toMatchObject([
      {
        type: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
      {
        parentRunId: started.run.id,
        type: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
      {
        parentRunId: branch.run.id,
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
    ]);
  });

  it("refreshes a completed multi-task parent when a child workflow resumes from approval", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "你是不是脑残，全家死光")],
    });
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor({
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
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        findings: [
          {
            category: "ABUSE",
            confidence: 0.92,
            evidence: ["脑残"],
            proposedAction: "HIDE_COMMENT",
            reason: "评论包含人身攻击。",
            severity: "HIGH",
            targetId: "comment-1",
          },
        ],
        summary: "LLM 识别出 1 条高风险评论。",
      }),
    );
    const { useCase } = createWorkflowControlHarness({
      actionExecutor,
      llm,
      repository,
    });

    const parent = await useCase.startWorkflow({
      input: {
        tasks: [
          {
            input: {
              scope: "today",
            },
            reason: "检查今日评论风险。",
            taskName: "comment_moderation_analysis",
          },
        ],
      },
      startedByUserId: "admin-1",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });

    const childResult = parent.output.childResults?.[0];

    if (!childResult?.runId || parent.interruption) {
      throw new Error("Expected multi-task parent to start a waiting child workflow.");
    }

    expect(parent).toMatchObject({
      output: {
        childResults: [
          {
            status: "WAITING_FOR_APPROVAL",
            workflowName: "COMMENT_MODERATION_ANALYSIS",
          },
        ],
      },
      run: {
        status: "COMPLETED",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
    });

    const waitingChildRun = await repository.findRunById(childResult.runId);
    const childFindingIds = toCommentModerationFindingIds(waitingChildRun?.interruption);

    expect(childFindingIds.length).toBeGreaterThan(0);

    const resumedChild = await useCase.resumeRun({
      actor: {
        id: "admin-2",
        login: "adrian",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      resume: {
        decision: "APPROVE",
        findingIds: childFindingIds,
      },
      runId: childResult.runId,
    });

    expect(resumedChild).toMatchObject({
      interruption: null,
      output: {
        actionResult: {
          appliedCount: 1,
          failedCount: 0,
        },
      },
      run: {
        id: childResult.runId,
        parentRunId: parent.run.id,
        parentRunRelation: "CHILD_TASK",
        status: "COMPLETED",
      },
    });

    const refreshedParent = await repository.findRunById(parent.run.id);

    expect(refreshedParent).toMatchObject({
      output: {
        childResults: [
          {
            runId: childResult.runId,
            status: "COMPLETED",
            workflowName: "COMMENT_MODERATION_ANALYSIS",
          },
        ],
        plannedTaskCount: 1,
      },
      status: "COMPLETED",
      summary: expect.stringContaining("完成 1 个"),
    });
    expect(actionExecutor.calls).toEqual([
      expect.objectContaining({
        action: "HIDE_COMMENT",
        findingIds: childFindingIds,
        subject: "ARTICLE_COMMENT",
      }),
    ]);
  });
});

function toCommentModerationFindingIds(interruption: unknown) {
  if (!interruption || typeof interruption !== "object" || !("findingIds" in interruption)) {
    return [];
  }

  const findingIds = (interruption as { findingIds?: unknown }).findingIds;

  return Array.isArray(findingIds)
    ? findingIds.filter((findingId): findingId is string => typeof findingId === "string")
    : [];
}

function createWorkflowControlHarness(input: {
  actionExecutor?: RecordingAdminAgentWorkflowActionExecutor;
  llm: ReturnType<typeof createChatCompletionClientDouble>;
  repository: RecordingAdminAgentRepository;
}) {
  const runner = new LangGraphAdminAgentWorkflowRunner(
    input.repository,
    input.actionExecutor ?? new RecordingAdminAgentWorkflowActionExecutor(),
    input.llm,
    createConfigServiceDouble(),
    undefined,
    undefined,
    undefined,
    undefined,
    {
      checkpointer: new MemorySaver(),
    },
  );
  const useCase = new ManageAdminAgentWorkflowsUseCase(
    input.repository,
    new RegisteredAdminAgentWorkflowRegistry(runner),
    {
      execute: vi.fn().mockResolvedValue({
        action: "ADMIN_AGENT_TASK_RESUMED",
        actorLogin: "admin",
        actorUserId: "admin-1",
        createdAt: new Date("2026-07-04T10:00:00.000Z"),
        id: "audit-1",
        ipAddress: null,
        metadata: null,
        resourceId: null,
        resourceType: "ADMIN_AGENT_TASK",
        summary: "恢复 Agent 业务处理",
        userAgent: null,
      }),
    } as never,
    {
      execute: vi.fn().mockResolvedValue({
        failedCount: 0,
        repairedCount: 0,
        skippedCount: 0,
      }),
    } as never,
  );

  return {
    runner,
    useCase,
  };
}
