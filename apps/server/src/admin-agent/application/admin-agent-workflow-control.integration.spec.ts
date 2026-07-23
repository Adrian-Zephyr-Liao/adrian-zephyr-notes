import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it, vi } from "vitest";
import {
  AdminAgentWorkflowResumeUnsupportedError,
  AdminAgentWorkflowUnsupportedControlActionError,
  ManageAdminAgentWorkflowsUseCase,
} from "./manage-admin-agent-workflows.use-case";
import { RegisteredAdminAgentWorkflowRegistry } from "./admin-agent-workflow-registry";
import { LangGraphAdminAgentWorkflowRunner } from "../infrastructure/langgraph-admin-agent-workflow.runner";
import {
  RecordingAdminAgentRepository,
  RecordingAdminAgentWorkflowActionExecutor,
  createChatCompletionClientDouble,
  createComment,
  createConfigServiceDouble,
} from "../testing/admin-agent-workflow-test-doubles";

describe("admin agent workflow control integration", () => {
  it("completes comment analysis as a read-only business capability", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "你是不是脑残，全家死光")],
    });
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor({
      appliedCount: 1,
      failedCount: 0,
      results: [{ resourceId: "comment-1", status: "APPLIED" }],
    });
    const { useCase } = createWorkflowControlHarness({
      actionExecutor,
      llm: createCommentAnalysisLlm(),
      repository,
    });

    const result = await useCase.startWorkflow({
      input: { scope: "today" },
      startedByUserId: "admin-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(result).toMatchObject({
      interruption: null,
      output: {
        analyzedCount: 1,
        findingCount: 1,
        findingIds: ["finding-1"],
        scope: "today",
      },
      run: {
        status: "COMPLETED",
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
      summary: "LLM 识别出 1 条高风险评论。",
    });
    expect(repository.createdFindings).toHaveLength(1);
    expect(repository.interruptedRuns).toEqual([]);
    expect(actionExecutor.calls).toEqual([]);

    await expect(
      useCase.controlRun({
        action: "branch",
        runId: result.run.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowUnsupportedControlActionError);
    await expect(
      useCase.resumeRun({
        actor: { id: "admin-1", login: "adrian" },
        resume: { decision: "approve" },
        runId: result.run.id,
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowResumeUnsupportedError);
  });

  it("composes comment analysis inside an approved multi-task plan without child approval", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "你是不是脑残，全家死光")],
    });
    const { useCase } = createWorkflowControlHarness({
      llm: createCommentAnalysisLlm(),
      repository,
    });
    const started = await useCase.startWorkflow({
      input: {
        approvalMode: "required",
        tasks: [
          {
            input: { scope: "today" },
            reason: "检查今日评论风险。",
            taskName: "comment_moderation_analysis",
          },
        ],
      },
      startedByUserId: "admin-1",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });

    if (started.interruption?.kind !== "ADMIN_AGENT_APPROVAL") {
      throw new Error("Expected multi-task plan approval.");
    }

    const resumed = await useCase.resumeRun({
      actor: { id: "admin-1", login: "adrian" },
      resume: {
        action: started.interruption.action,
        approvalId: started.interruption.approvalId,
        decision: "approve",
        payload: started.interruption.payload,
        subject: started.interruption.subject,
      },
      runId: started.run.id,
    });

    expect(resumed).toMatchObject({
      interruption: null,
      output: {
        childResults: [
          {
            interruptionKind: null,
            status: "COMPLETED",
            workflowName: "COMMENT_MODERATION_ANALYSIS",
          },
        ],
        plannedTaskCount: 1,
      },
      run: {
        status: "COMPLETED",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
      summary: expect.stringContaining("完成 1 个"),
    });
  });
});

function createCommentAnalysisLlm() {
  return createChatCompletionClientDouble(
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
        createdAt: new Date("2026-07-22T00:00:00.000Z"),
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

  return { useCase };
}
