import { describe, expect, it } from "vitest";
import { MemorySaver } from "@langchain/langgraph";
import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type { AdminAgentWorkflowActionExecutor } from "../domain/admin-agent-workflow-action-executor";
import {
  isAdminAgentWorkflowActionExecutionInProgress,
  type AdminAgentWorkflowActionExecution,
} from "../domain/admin-agent-workflow-action-execution.entity";
import {
  parseCommentAnalysisResponse,
  type AdminAgentCommentForAnalysis,
} from "../domain/admin-agent-comment-analysis";
import type {
  AdminAgentFinding,
  AdminAgentFindingDraft,
} from "../domain/admin-agent-finding.entity";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import {
  createAdminAgentWorkflowCancelledEvent,
  createAdminAgentWorkflowCompletedEvent,
  createAdminAgentWorkflowFailedEvent,
  createAdminAgentWorkflowInterruptedEvent,
  createAdminAgentWorkflowNodeStartedEvent,
  createAdminAgentWorkflowRunAttemptEvent,
  createAdminAgentWorkflowRunCreatedEvent,
} from "../domain/admin-agent-workflow-lifecycle";
import { AdminAgentWorkflowInvalidResumeError } from "../domain/admin-agent-workflow-runner";
import type { GetAdminArticleByIdUseCase } from "../../articles/application/get-admin-article-by-id.use-case";
import type { ListAdminArticlesUseCase } from "../../articles/application/list-admin-articles.use-case";
import type {
  AdminArticleDetail,
  AdminArticleListItem,
} from "../../articles/domain/admin-article.repository";
import type { AdminOperationLog } from "../../audit/domain/admin-operation-log";
import type { ListAdminOperationLogsUseCase } from "../../audit/application/list-admin-operation-logs.use-case";
import type { GetAdminSiteConfigUseCase } from "../../site-config/application/get-admin-site-config.use-case";
import { SiteAnnouncement } from "../../site-config/domain/site-announcement.entity";
import { defaultSiteConfigSettings } from "../../site-config/domain/site-settings";
import { OpenAiCompatibleChatCompletionClient } from "./ai/openai-compatible-chat-completion.client";
import {
  LangGraphAdminAgentWorkflowRunner,
  assertAdminAgentWorkflowRuntimeCatalog,
} from "./langgraph-admin-agent-workflow.runner";

describe("LangGraphAdminAgentWorkflowRunner", () => {
  it("keeps the internal LangGraph runtime catalog aligned with workflow metadata", () => {
    expect(() =>
      assertAdminAgentWorkflowRuntimeCatalog({
        ARTICLE_ASSISTANCE: {},
        AUDIT_REVIEW: {},
        COMMENT_MODERATION_ANALYSIS: {},
        MULTI_TASK_ORCHESTRATION: {},
        SITE_CONFIG_REVIEW: {},
      }),
    ).not.toThrow();
  });

  it("fails fast when a metadata workflow is missing from the runtime catalog", () => {
    expect(() =>
      assertAdminAgentWorkflowRuntimeCatalog({
        ARTICLE_ASSISTANCE: {},
        AUDIT_REVIEW: {},
        COMMENT_MODERATION_ANALYSIS: {},
        SITE_CONFIG_REVIEW: {},
      }),
    ).toThrow(
      "Admin agent workflow runtime catalog is out of sync with workflow metadata. Missing: MULTI_TASK_ORCHESTRATION.",
    );
  });

  it("fails fast when the runtime catalog exposes a workflow outside metadata", () => {
    expect(() =>
      assertAdminAgentWorkflowRuntimeCatalog({
        ARTICLE_ASSISTANCE: {},
        AUDIT_REVIEW: {},
        COMMENT_MODERATION_ANALYSIS: {},
        EXPERIMENTAL_DEBUG_WORKFLOW: {},
        MULTI_TASK_ORCHESTRATION: {},
        SITE_CONFIG_REVIEW: {},
      }),
    ).toThrow(
      "Admin agent workflow runtime catalog is out of sync with workflow metadata. Unexpected: EXPERIMENTAL_DEBUG_WORKFLOW.",
    );
  });

  it("does not allow branch runs to be started without checkpoint branching", async () => {
    const repository = new RecordingAdminAgentRepository();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble("{}"),
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    await expect(
      runner.startWorkflow({
        parentRunId: "source-run",
        startReason: "BRANCH",
        startedByUserId: "user-1",
        workflowName: "AUDIT_REVIEW",
      }),
    ).rejects.toThrow(
      "Admin agent branch workflows must be started through branchWorkflow: AUDIT_REVIEW",
    );
    expect(repository.createdRuns).toHaveLength(0);
  });

  it("does not allow retry runs without an auditable parent run", async () => {
    const repository = new RecordingAdminAgentRepository();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble("{}"),
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    await expect(
      runner.startWorkflow({
        startReason: "RETRY",
        startedByUserId: "user-1",
        workflowName: "AUDIT_REVIEW",
      }),
    ).rejects.toThrow("Admin agent retry workflows require parentRunId: AUDIT_REVIEW");
    expect(repository.createdRuns).toHaveLength(0);
  });

  it("does not allow manual runs to attach a parent run", async () => {
    const repository = new RecordingAdminAgentRepository();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble("{}"),
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    await expect(
      runner.startWorkflow({
        parentRunId: "parent-run",
        startedByUserId: "user-1",
        workflowName: "AUDIT_REVIEW",
      }),
    ).rejects.toThrow("Admin agent manual workflows cannot attach parentRunId: AUDIT_REVIEW");
    expect(repository.createdRuns).toHaveLength(0);
  });

  it("does not allow child workflow runs without a dedupe key", async () => {
    const repository = new RecordingAdminAgentRepository();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble("{}"),
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    await expect(
      runner.startWorkflow({
        parentRunId: "parent-run",
        startReason: "CHAT_INTENT",
        startedByUserId: "user-1",
        workflowName: "AUDIT_REVIEW",
      }),
    ).rejects.toThrow(
      "Admin agent child workflows require a dedupeKey when parentRunId is set: AUDIT_REVIEW",
    );
    expect(repository.createdRuns).toHaveLength(0);
  });

  it("runs comment moderation analysis through LangGraph and interrupts for approval", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [
        createComment("comment-1", "你是不是脑残，全家死光"),
        createComment("comment-2", "hello"),
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
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      actionExecutor,
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        scope: "today",
      },
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(repository.createdRuns).toMatchObject([
      {
        input: {
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
        startedByUserId: "user-1",
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
    ]);
    expect(repository.createdFindings).toMatchObject([
      {
        category: "ABUSE",
        proposedAction: "HIDE_COMMENT",
        reason: "评论包含人身攻击和恶意诅咒。",
        severity: "HIGH",
        targetId: "comment-1",
      },
    ]);
    expect(repository.interruptedRuns).toEqual([
      {
        id: expect.any(String),
        node: "human_approval",
        summary: "等待管理员确认 1 条评论治理建议。",
      },
    ]);
    expect(repository.createdRuns[0]?.id).toBe(repository.createdRuns[0]?.threadId);
    expect(result).toMatchObject({
      interruption: {
        action: "HIDE_COMMENT",
        approvalId: expect.stringContaining("comment-moderation:"),
        findingIds: ["finding-1"],
        kind: "COMMENT_MODERATION_APPROVAL",
        payload: {
          findingIds: ["finding-1"],
          scope: "today",
        },
        subject: "ARTICLE_COMMENT",
        summary: "确认后将屏蔽 1 条评论。",
      },
      run: {
        status: "WAITING_FOR_APPROVAL",
      },
      scope: "today",
      summary: "LLM 识别出 1 条高风险评论。",
    });
  });

  it("retries transient LLM failures inside the same comment moderation workflow run", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "你是不是脑残，全家死光")],
    });
    const llm = createFlakyChatCompletionClientDouble([
      new Error("LLM rate limit"),
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
        summary: "LLM 重试后识别出 1 条高风险评论。",
      }),
    ]);
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        scope: "today",
      },
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(llm.calls).toHaveLength(2);
    expect(repository.createdRuns).toHaveLength(1);
    expect(repository.failedRuns).toEqual([]);
    expect(result).toMatchObject({
      interruption: {
        kind: "COMMENT_MODERATION_APPROVAL",
      },
      run: {
        id: repository.createdRuns[0]?.id,
        status: "WAITING_FOR_APPROVAL",
      },
      summary: "LLM 重试后识别出 1 条高风险评论。",
    });
  });

  it("completes comment moderation with a domain output when no approval is needed", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "谢谢分享，很有帮助")],
    });
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        findings: [],
        summary: "LLM 未识别出需要人工确认的评论风险。",
      }),
    );
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        scope: "today",
      },
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(result).toMatchObject({
      interruption: null,
      output: {
        actionResult: null,
        findingCount: 0,
        scope: "today",
      },
      run: {
        status: "COMPLETED",
      },
      summary: "LLM 未识别出需要人工确认的评论风险。",
    });
  });

  it("resumes an interrupted comment moderation workflow with the same thread id", async () => {
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
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      actionExecutor,
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    if (started.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    const resumed = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        decision: "DEFER",
        findingIds: started.interruption.findingIds,
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(resumed.interruption).toBeNull();
    expect(resumed.output).toMatchObject({
      actionResult: null,
    });
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.summary).toContain("管理员选择暂不执行写操作");
    expect(actionExecutor.calls).toEqual([]);
    expect(repository.nodeUpdates.map((item) => item.node)).not.toContain("human_approval");
    expect(repository.nodeUpdates.map((item) => item.node)).toContain("apply_approval");
    expect(repository.runningTransitions).toContainEqual({
      id: started.run.id,
      resumed: true,
    });
  });

  it("branches an interrupted comment moderation task into an independently resumable thread", async () => {
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
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      actionExecutor,
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    if (started.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    const branched = await runner.branchWorkflow({
      parentRunId: started.run.id,
      sourceThreadId: started.run.threadId ?? started.run.id,
      startedByUserId: "user-2",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(branched.run.id).not.toBe(started.run.id);
    expect(branched.run.threadId).toBe(branched.run.id);
    expect(branched.run.parentRunId).toBe(started.run.id);
    expect(branched.run.parentRunRelation).toBe("BRANCH");
    expect(branched.run.status).toBe("WAITING_FOR_APPROVAL");
    expect(branched.interruption).toMatchObject({
      approvalId: `comment-moderation:${branched.run.id}`,
      findingIds: ["finding-1"],
      kind: "COMMENT_MODERATION_APPROVAL",
    });

    const resumedBranch = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        decision: "DEFER",
        findingIds: started.interruption.findingIds,
      },
      threadId: branched.run.threadId ?? branched.run.id,
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(resumedBranch.run.id).toBe(branched.run.id);
    expect(resumedBranch.run.status).toBe("COMPLETED");
    expect((await repository.findRunById(started.run.id))?.status).toBe("WAITING_FOR_APPROVAL");
  });

  it("does not create branch runs for completed comment moderation tasks", async () => {
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
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    if (started.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        decision: "DEFER",
        findingIds: started.interruption.findingIds,
      },
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    const createdRunCount = repository.createdRuns.length;

    await expect(
      runner.branchWorkflow({
        parentRunId: started.run.id,
        sourceThreadId: started.run.threadId ?? started.run.id,
        startedByUserId: "user-2",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).rejects.toThrow("Admin agent branch source must be waiting for approval");
    expect(repository.createdRuns).toHaveLength(createdRunCount);
  });

  it("does not branch a source run through a different workflow graph", async () => {
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
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    if (started.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    const createdRunCount = repository.createdRuns.length;

    await expect(
      runner.branchWorkflow({
        parentRunId: started.run.id,
        sourceThreadId: started.run.threadId ?? started.run.id,
        startedByUserId: "user-2",
        workflowName: "ARTICLE_ASSISTANCE",
      }),
    ).rejects.toThrow("Admin agent branch source workflow mismatch");
    expect(repository.createdRuns).toHaveLength(createdRunCount);
  });

  it("does not resume a thread through a different workflow graph", async () => {
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
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    if (started.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    const runningTransitionCount = repository.runningTransitions.length;

    await expect(
      runner.resumeWorkflow({
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        resume: {},
        threadId: started.run.threadId ?? started.run.id,
        workflowName: "ARTICLE_ASSISTANCE",
      }),
    ).rejects.toThrow("Admin agent workflow thread mismatch");
    expect(repository.runningTransitions).toHaveLength(runningTransitionCount);
  });

  it("executes approved comment moderation findings while resuming the workflow", async () => {
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
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor({
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "finding-1",
          status: "APPLIED",
        },
      ],
    });
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      actionExecutor,
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    if (started.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    const resumed = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        decision: "APPROVE",
        findingIds: started.interruption.findingIds,
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(actionExecutor.calls).toEqual([
      {
        action: "HIDE_COMMENT",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        findingIds: ["finding-1"],
        payload: {
          findingIds: ["finding-1"],
        },
        subject: "ARTICLE_COMMENT",
      },
    ]);
    expect(resumed.interruption).toBeNull();
    expect(resumed.output).toMatchObject({
      actionResult: {
        appliedCount: 1,
        failedCount: 0,
        results: [
          {
            resourceId: "finding-1",
            status: "APPLIED",
          },
        ],
      },
    });
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.summary).toContain("管理员已确认 1 条评论治理建议；已执行 1 条，失败 0 条。");
  });

  it("keeps an interrupted comment moderation run paused when resume payload is invalid", async () => {
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
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    await expect(
      runner.resumeWorkflow({
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        resume: {
          findingIds:
            started.interruption?.kind === "COMMENT_MODERATION_APPROVAL"
              ? started.interruption.findingIds
              : [],
        },
        threadId: started.run.threadId ?? started.run.id,
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowInvalidResumeError);

    expect(repository.runningTransitions).toEqual([{ id: started.run.id, resumed: false }]);
    expect((await repository.findRunById(started.run.id))?.status).toBe("WAITING_FOR_APPROVAL");
  });

  it("reuses a succeeded comment moderation approval action when a resumed node replays", async () => {
    const repository = new RecordingAdminAgentRepository();
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor({
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "finding-1",
          status: "APPLIED",
          summary: "评论已屏蔽。",
        },
      ],
    });
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      actionExecutor,
      createChatCompletionClientDouble("{}"),
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    await repository.createRun({
      id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      input: {},
      startedByUserId: "user-1",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    await repository.createFindings("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", [
      {
        category: "ABUSE",
        confidence: 0.92,
        evidence: ["脑残"],
        proposedAction: "HIDE_COMMENT",
        reason: "评论包含人身攻击。",
        severity: "HIGH",
        targetId: "comment-1",
        targetType: "ARTICLE_COMMENT",
      },
    ]);
    const approval = {
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      decision: "APPROVE" as const,
      findingIds: ["finding-1"],
    };
    const runnerInternals = runner as unknown as {
      applyApproval: (state: {
        approval: typeof approval;
        runId: string;
        summary: string;
      }) => Promise<{ summary: string }>;
    };

    const firstResult = await runnerInternals.applyApproval({
      approval,
      runId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      summary: "评论治理建议已生成。",
    });
    const replayedResult = await runnerInternals.applyApproval({
      approval,
      runId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
      summary: "评论治理建议已生成。",
    });

    expect(firstResult).toEqual(replayedResult);
    expect(actionExecutor.calls).toHaveLength(1);
  });

  it("recovers completed comment moderation approval results without executing twice", async () => {
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
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor();
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      actionExecutor,
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      startedByUserId: "user-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    if (started.interruption?.kind !== "COMMENT_MODERATION_APPROVAL") {
      throw new Error("Expected comment moderation approval interruption.");
    }

    await repository.markFindingExecuted(started.interruption.findingIds[0] ?? "");

    const resumed = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        decision: "APPROVE",
        findingIds: started.interruption.findingIds,
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(actionExecutor.calls).toEqual([]);
    expect(resumed.interruption).toBeNull();
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.summary).toContain("管理员已确认 1 条评论治理建议；已执行 1 条，失败 0 条。");
  });

  it("retries comment moderation as a new child task with its own persisted thread", async () => {
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
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const retry = await runner.startWorkflow({
      input: {
        scope: "today",
      },
      parentRunId: "failed-run",
      startedByUserId: "user-2",
      startReason: "RETRY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(retry.run.parentRunId).toBe("failed-run");
    expect(retry.run.parentRunRelation).toBe("RETRY");
    expect(retry.run.threadId).toBe(retry.run.id);
    expect(retry.run.threadId).not.toBe("failed-run");
    expect(repository.createdRuns[0]).toMatchObject({
      input: {
        requestedAt: expect.any(String),
        startReason: "RETRY",
        workflowInput: {
          scope: "today",
        },
      },
      metadata: {
        startReason: "RETRY",
      },
      parentRunId: "failed-run",
      startedByUserId: "user-2",
    });
  });

  it("runs article assistance through a separate LangGraph workflow", async () => {
    const repository = new RecordingAdminAgentRepository();
    const article = createAdminArticleDetail({
      id: "article-1",
      markdown: "# 发布检查\n\n这是一篇需要发布前检查的草稿。",
      status: "DRAFT",
      title: "发布检查",
    });
    const articles = new RecordingListAdminArticlesUseCase([article]);
    const articleDetails = new RecordingGetAdminArticleByIdUseCase({
      "article-1": article,
    });
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        checks: [
          {
            articleId: "article-1",
            evidence: ["文章仍为 DRAFT，正文已有初稿。"],
            recommendation: "补充摘要和封面后再进入发布前审批。",
            status: "WARN",
            title: "发布准备度不足",
          },
        ],
        nextActions: ["补全摘要", "检查封面图"],
        summary: "文章巡检发现 1 个发布前注意项。",
      }),
    );
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      articles as unknown as ListAdminArticlesUseCase,
      articleDetails as unknown as GetAdminArticleByIdUseCase,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        articleId: "article-1",
        status: "DRAFT",
      },
      startedByUserId: "user-1",
      workflowName: "ARTICLE_ASSISTANCE",
    });

    expect(repository.createdRuns).toMatchObject([
      {
        input: {
          requestedAt: expect.any(String),
          startReason: "MANUAL",
          workflowInput: {
            articleId: "article-1",
            status: "DRAFT",
          },
        },
        metadata: {
          graph: "articleAssistanceWorkflow",
          requestedAt: expect.any(String),
          startReason: "MANUAL",
        },
        startedByUserId: "user-1",
        type: "ARTICLE_ASSISTANCE",
        workflowName: "ARTICLE_ASSISTANCE",
      },
    ]);
    expect(articles.calls).toEqual([
      {
        page: 1,
        pageSize: 20,
        search: undefined,
        status: "DRAFT",
      },
    ]);
    expect(articleDetails.calls).toEqual(["article-1"]);
    expect(repository.nodeUpdates.map((item) => item.node)).toEqual([
      "load_articles",
      "analyze_articles",
      "complete_article_assistance",
    ]);
    expect(repository.workflowEvents).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          workflowName: "ARTICLE_ASSISTANCE",
        }),
        type: "RUN_CREATED",
      }),
      expect.objectContaining({
        payload: {
          attemptCount: 1,
          resumed: false,
        },
        type: "RUN_ATTEMPT_STARTED",
      }),
      expect.objectContaining({
        node: "load_articles",
        payload: null,
        type: "NODE_STARTED",
      }),
      expect.objectContaining({
        node: "analyze_articles",
        payload: {
          articleCount: 1,
          detailArticleId: "article-1",
        },
        type: "NODE_STARTED",
      }),
      expect.objectContaining({
        node: "complete_article_assistance",
        payload: null,
        type: "NODE_STARTED",
      }),
      expect.objectContaining({
        node: "completed",
        type: "COMPLETED",
      }),
    ]);
    await expect(
      repository.findRunById(repository.createdRuns[0]?.id ?? ""),
    ).resolves.toMatchObject({
      metadata: {
        graph: "articleAssistanceWorkflow",
        startReason: "MANUAL",
      },
    });
    expect(result).toMatchObject({
      interruption: null,
      output: {
        articleCount: 1,
        checks: [
          {
            articleId: "article-1",
            status: "WARN",
            title: "发布准备度不足",
          },
        ],
        detailArticleId: "article-1",
        nextActions: ["补全摘要", "检查封面图"],
      },
      run: {
        status: "COMPLETED",
        type: "ARTICLE_ASSISTANCE",
        workflowName: "ARTICLE_ASSISTANCE",
      },
      summary: "文章巡检发现 1 个发布前注意项。",
    });
  });

  it("can interrupt and resume article assistance through a generic approval node", async () => {
    const repository = new RecordingAdminAgentRepository();
    const article = createAdminArticleDetail({
      id: "article-1",
      markdown: "# 发布检查\n\n这是一篇需要发布前检查的草稿。",
      status: "DRAFT",
      title: "发布检查",
    });
    const articles = new RecordingListAdminArticlesUseCase([article]);
    const articleDetails = new RecordingGetAdminArticleByIdUseCase({
      "article-1": article,
    });
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        checks: [
          {
            articleId: "article-1",
            evidence: ["文章仍为 DRAFT。"],
            recommendation: "发布前补充摘要。",
            status: "WARN",
            title: "摘要缺失",
          },
        ],
        nextActions: ["补全摘要"],
        summary: "文章巡检需要确认。",
      }),
    );
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      articles as unknown as ListAdminArticlesUseCase,
      articleDetails as unknown as GetAdminArticleByIdUseCase,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const started = await runner.startWorkflow({
      input: {
        articleId: "article-1",
        requiresApproval: true,
        status: "DRAFT",
      },
      startedByUserId: "user-1",
      workflowName: "ARTICLE_ASSISTANCE",
    });

    expect(started).toMatchObject({
      interruption: {
        action: "REVIEW_ARTICLE_ASSISTANCE",
        kind: "ADMIN_AGENT_APPROVAL",
        subject: "ARTICLE",
      },
      run: {
        status: "WAITING_FOR_APPROVAL",
      },
      summary: "文章巡检需要确认。",
    });
    expect(repository.interruptedRuns).toEqual([
      {
        id: started.run.id,
        node: "request_article_approval",
        summary: "文章巡检需要确认。",
      },
    ]);

    const resumed = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        action: "REVIEW_ARTICLE_ASSISTANCE",
        approvalId: started.interruption?.approvalId,
        decision: "approve",
        payload: {},
        subject: "ARTICLE",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "ARTICLE_ASSISTANCE",
    });

    expect(resumed.interruption).toBeNull();
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.summary).toContain("管理员已确认继续执行。");
    expect(repository.nodeUpdates.map((item) => item.node)).not.toContain(
      "request_article_approval",
    );
    expect(repository.runningTransitions).toContainEqual({
      id: started.run.id,
      resumed: true,
    });
    expect(repository.nodeUpdates.map((item) => item.node)).toContain(
      "complete_article_assistance",
    );
  });

  it("branches a generic article approval task into an independently resumable thread", async () => {
    const repository = new RecordingAdminAgentRepository();
    const article = createAdminArticleDetail({
      id: "article-1",
      markdown: "# 发布检查\n\n这是一篇需要发布前检查的草稿。",
      status: "DRAFT",
      title: "发布检查",
    });
    const articles = new RecordingListAdminArticlesUseCase([article]);
    const articleDetails = new RecordingGetAdminArticleByIdUseCase({
      "article-1": article,
    });
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        checks: [
          {
            articleId: "article-1",
            evidence: ["文章仍为 DRAFT。"],
            recommendation: "发布前补充摘要。",
            status: "WARN",
            title: "摘要缺失",
          },
        ],
        nextActions: ["补全摘要"],
        summary: "文章巡检需要确认。",
      }),
    );
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      articles as unknown as ListAdminArticlesUseCase,
      articleDetails as unknown as GetAdminArticleByIdUseCase,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      input: {
        articleId: "article-1",
        requiresApproval: true,
      },
      startedByUserId: "user-1",
      workflowName: "ARTICLE_ASSISTANCE",
    });

    const branched = await runner.branchWorkflow({
      parentRunId: started.run.id,
      sourceThreadId: started.run.threadId ?? started.run.id,
      startedByUserId: "user-2",
      workflowName: "ARTICLE_ASSISTANCE",
    });

    expect(branched.run.id).not.toBe(started.run.id);
    expect(branched.run.threadId).toBe(branched.run.id);
    expect(branched.run.parentRunId).toBe(started.run.id);
    expect(branched).toMatchObject({
      interruption: {
        action: "REVIEW_ARTICLE_ASSISTANCE",
        approvalId: `review_article_assistance:${branched.run.id}`,
        kind: "ADMIN_AGENT_APPROVAL",
        subject: "ARTICLE",
      },
      run: {
        status: "WAITING_FOR_APPROVAL",
      },
    });

    const resumedBranch = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        action: "REVIEW_ARTICLE_ASSISTANCE",
        approvalId: branched.interruption?.approvalId,
        decision: "defer",
        payload: {},
        subject: "ARTICLE",
      },
      threadId: branched.run.threadId ?? branched.run.id,
      workflowName: "ARTICLE_ASSISTANCE",
    });

    expect(resumedBranch.run.id).toBe(branched.run.id);
    expect(resumedBranch.run.status).toBe("COMPLETED");
    expect(resumedBranch.summary).toContain("管理员选择暂不继续执行。");
    expect((await repository.findRunById(started.run.id))?.status).toBe("WAITING_FOR_APPROVAL");
  });

  it("rejects generic approval resumes that do not match the current interruption", async () => {
    const repository = new RecordingAdminAgentRepository();
    const article = createAdminArticleDetail({
      id: "article-1",
      status: "DRAFT",
      title: "发布检查",
    });
    const articles = new RecordingListAdminArticlesUseCase([article]);
    const articleDetails = new RecordingGetAdminArticleByIdUseCase({
      "article-1": article,
    });
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        checks: [
          {
            articleId: "article-1",
            evidence: ["文章仍为 DRAFT。"],
            recommendation: "发布前补充摘要。",
            status: "WARN",
            title: "摘要缺失",
          },
        ],
        nextActions: ["补全摘要"],
        summary: "文章巡检需要确认。",
      }),
    );
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      articles as unknown as ListAdminArticlesUseCase,
      articleDetails as unknown as GetAdminArticleByIdUseCase,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      input: {
        articleId: "article-1",
        requiresApproval: true,
      },
      startedByUserId: "user-1",
      workflowName: "ARTICLE_ASSISTANCE",
    });

    await expect(
      runner.resumeWorkflow({
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        resume: {
          action: started.interruption?.action,
          approvalId: "different-approval",
          decision: "approve",
          payload: started.interruption?.payload,
          subject: started.interruption?.subject,
        },
        threadId: started.run.threadId ?? started.run.id,
        workflowName: "ARTICLE_ASSISTANCE",
      }),
    ).rejects.toThrow("approvalId does not match");

    expect((await repository.findRunById(started.run.id))?.status).toBe("WAITING_FOR_APPROVAL");
    expect(repository.runningTransitions).not.toContainEqual({
      id: started.run.id,
      resumed: true,
    });
  });

  it("runs audit review through a separate LangGraph workflow", async () => {
    const repository = new RecordingAdminAgentRepository();
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        nextActions: ["复核最近的评论状态变更。"],
        riskSignals: [
          {
            evidence: ["同一管理员短时间内多次修改评论状态"],
            level: "MEDIUM",
            recommendation: "抽查对应评论是否符合治理规则。",
            title: "评论治理操作集中",
          },
        ],
        summary: "审计发现 1 个需要关注的操作模式。",
      }),
    );
    const auditLogs = new RecordingListAdminOperationLogsUseCase([
      createAuditLog({
        action: "COMMENT_STATUS_UPDATED",
        metadata: {
          agentRunId: "run-1",
          checkpointId: "checkpoint-1",
          source: "admin_agent",
          status: "HIDDEN",
          threadId: "thread-1",
          workflowName: "COMMENT_MODERATION_ANALYSIS",
        },
        resourceId: "77649607-fadb-4d24-b5f4-bca8ae2ce7d7",
        resourceType: "article_comment",
        summary: "Updated article comment status to HIDDEN",
      }),
    ]);
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      auditLogs as unknown as ListAdminOperationLogsUseCase,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        actorLogin: "adrian",
      },
      startedByUserId: "user-1",
      workflowName: "AUDIT_REVIEW",
    });

    expect(repository.createdRuns).toMatchObject([
      {
        input: {
          requestedAt: expect.any(String),
          startReason: "MANUAL",
          workflowInput: {
            actorLogin: "adrian",
          },
        },
        metadata: {
          graph: "auditReviewWorkflow",
          requestedAt: expect.any(String),
          startReason: "MANUAL",
        },
        startedByUserId: "user-1",
        type: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
    expect(auditLogs.calls).toEqual([
      {
        action: undefined,
        actorLogin: "adrian",
        page: 1,
        pageSize: 30,
        search: undefined,
      },
    ]);
    const auditPrompt = JSON.parse(String(llm.calls[0]?.messages[1]?.content)) as {
      logs: Array<{
        metadata?: Record<string, unknown>;
        resourceId?: string;
        resourceType?: string;
        summary?: string;
      }>;
    };
    expect(auditPrompt.logs[0]).toMatchObject({
      metadata: {
        source: "Agent 工作台",
        status: "已隐藏",
      },
      resourceId: "77649607...",
      resourceType: "评论",
      summary: "评论已设为已隐藏",
    });
    expect(JSON.stringify(auditPrompt)).not.toContain("Updated article comment status to HIDDEN");
    expect(JSON.stringify(auditPrompt)).not.toContain("checkpoint");
    expect(JSON.stringify(auditPrompt)).not.toContain("thread");
    expect(JSON.stringify(auditPrompt)).not.toContain("workflow");
    expect(repository.nodeUpdates.map((item) => item.node)).toEqual([
      "load_audit_logs",
      "analyze_audit_logs",
      "complete_audit_review",
    ]);
    expect(result).toMatchObject({
      interruption: null,
      output: {
        logCount: 1,
        nextActions: ["复核最近的评论状态变更。"],
        riskSignals: [
          {
            level: "MEDIUM",
            title: "评论治理操作集中",
          },
        ],
      },
      run: {
        status: "COMPLETED",
        type: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      },
      summary: "审计发现 1 个需要关注的操作模式。",
    });
  });

  it("can interrupt and resume audit review through a generic approval node", async () => {
    const repository = new RecordingAdminAgentRepository();
    const auditLogs = new RecordingListAdminOperationLogsUseCase([
      createAuditLog({
        action: "ARTICLE_UPDATED",
        resourceId: "article-1",
        resourceType: "article",
      }),
    ]);
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble(
        JSON.stringify({
          nextActions: ["抽查文章更新内容。"],
          riskSignals: [
            {
              evidence: ["文章短时间内多次更新"],
              level: "LOW",
              recommendation: "确认更新是否符合发布流程。",
              title: "文章更新频繁",
            },
          ],
          summary: "审计分析需要管理员确认。",
        }),
      ),
      createConfigService(),
      auditLogs as unknown as ListAdminOperationLogsUseCase,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const started = await runner.startWorkflow({
      input: {
        requiresApproval: true,
      },
      startedByUserId: "user-1",
      workflowName: "AUDIT_REVIEW",
    });

    expect(started).toMatchObject({
      interruption: {
        action: "REVIEW_AUDIT_ANALYSIS",
        kind: "ADMIN_AGENT_APPROVAL",
        payload: {
          logCount: 1,
        },
        subject: "AUDIT_LOG",
      },
      run: {
        status: "WAITING_FOR_APPROVAL",
      },
    });
    expect(repository.interruptedRuns).toContainEqual({
      id: started.run.id,
      node: "request_audit_approval",
      summary: "审计分析需要管理员确认。",
    });

    const resumed = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        action: "REVIEW_AUDIT_ANALYSIS",
        approvalId: started.interruption?.approvalId,
        decision: "approve",
        payload: started.interruption?.payload ?? {},
        subject: "AUDIT_LOG",
      },
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "AUDIT_REVIEW",
    });

    expect(resumed.interruption).toBeNull();
    expect(resumed.output).toMatchObject({
      logCount: 1,
      nextActions: ["抽查文章更新内容。"],
    });
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.summary).toContain("管理员已确认继续执行。");
    expect(repository.runningTransitions).toContainEqual({
      id: started.run.id,
      resumed: true,
    });
  });

  it("runs site config review through a separate LangGraph workflow", async () => {
    const repository = new RecordingAdminAgentRepository();
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        checks: [
          {
            evidence: ["首页主按钮指向文章列表，导航包含留言板。"],
            recommendation: "保持当前主路径，后续可增加关于页入口。",
            status: "PASS",
            title: "首页与导航一致",
          },
        ],
        nextActions: ["复核禁用公告是否仍有保留价值。"],
        summary: "站点配置审查完成，未发现阻断性问题。",
      }),
    );
    const siteConfig = new RecordingGetAdminSiteConfigUseCase({
      announcements: [
        SiteAnnouncement.create({
          command: "查看公告",
          createdAt: new Date("2026-07-04T10:00:00.000Z"),
          icon: "sparkles",
          iconClassName: "text-primary",
          id: "announcement-1",
          isEnabled: true,
          key: "welcome",
          output: "展示欢迎公告",
          process: "首页公告",
          sortOrder: 10,
          status: "已启用",
          title: "欢迎",
          updatedAt: new Date("2026-07-04T10:00:00.000Z"),
        }),
      ],
      settings: defaultSiteConfigSettings,
    });
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      siteConfig as unknown as GetAdminSiteConfigUseCase,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        requestedArea: "navigation",
      },
      startedByUserId: "user-1",
      workflowName: "SITE_CONFIG_REVIEW",
    });

    expect(repository.createdRuns).toMatchObject([
      {
        input: {
          requestedAt: expect.any(String),
          startReason: "MANUAL",
          workflowInput: {
            requestedArea: "navigation",
          },
        },
        metadata: {
          graph: "siteConfigReviewWorkflow",
          requestedAt: expect.any(String),
          startReason: "MANUAL",
        },
        startedByUserId: "user-1",
        type: "SITE_CONFIG_REVIEW",
        workflowName: "SITE_CONFIG_REVIEW",
      },
    ]);
    expect(siteConfig.calls).toEqual([{}]);
    expect(repository.nodeUpdates.map((item) => item.node)).toEqual([
      "load_site_config",
      "analyze_site_config",
      "complete_site_config_review",
    ]);
    expect(result).toMatchObject({
      interruption: null,
      output: {
        announcementCount: 1,
        checks: [
          {
            status: "PASS",
            title: "首页与导航一致",
          },
        ],
        navigationItemCount: defaultSiteConfigSettings.navigationItems.length,
        socialLinkCount: defaultSiteConfigSettings.socialLinks.length,
      },
      run: {
        status: "COMPLETED",
        type: "SITE_CONFIG_REVIEW",
        workflowName: "SITE_CONFIG_REVIEW",
      },
      summary: "站点配置审查完成，未发现阻断性问题。",
    });
  });

  it("executes approved site config actions after the admin confirms", async () => {
    const repository = new RecordingAdminAgentRepository();
    const actionExecutor = new RecordingAdminAgentWorkflowActionExecutor({
      appliedCount: 1,
      failedCount: 0,
      results: [
        {
          resourceId: "announcement-1",
          status: "APPLIED",
        },
      ],
    });
    const siteConfig = new RecordingGetAdminSiteConfigUseCase({
      announcements: [
        SiteAnnouncement.create({
          command: "查看公告",
          createdAt: new Date("2026-07-04T10:00:00.000Z"),
          icon: "sparkles",
          iconClassName: "text-primary",
          id: "announcement-1",
          isEnabled: true,
          key: "welcome",
          output: "展示欢迎公告",
          process: "首页公告",
          sortOrder: 10,
          status: "已启用",
          title: "欢迎",
          updatedAt: new Date("2026-07-04T10:00:00.000Z"),
        }),
      ],
      settings: defaultSiteConfigSettings,
    });
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      actionExecutor,
      createChatCompletionClientDouble(
        JSON.stringify({
          checks: [],
          nextActions: ["暂停首页欢迎公告。"],
          summary: "站点公告需要管理员确认。",
        }),
      ),
      createConfigService(),
      undefined,
      siteConfig as unknown as GetAdminSiteConfigUseCase,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const started = await runner.startWorkflow({
      input: {
        actionPayload: {
          announcementId: "announcement-1",
          isEnabled: false,
        },
        proposedAction: "UPDATE_SITE_ANNOUNCEMENT",
        requiresApproval: true,
      },
      startedByUserId: "user-1",
      workflowName: "SITE_CONFIG_REVIEW",
    });

    expect(started).toMatchObject({
      interruption: {
        action: "UPDATE_SITE_ANNOUNCEMENT",
        kind: "ADMIN_AGENT_APPROVAL",
        payload: {
          announcementId: "announcement-1",
          isEnabled: false,
        },
        subject: "SITE_CONFIG",
      },
      run: {
        status: "WAITING_FOR_APPROVAL",
      },
    });
    expect(repository.interruptedRuns).toContainEqual({
      id: started.run.id,
      node: "request_site_config_approval",
      summary: "站点公告需要管理员确认。",
    });

    const resumed = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: {
        action: "UPDATE_SITE_ANNOUNCEMENT",
        approvalId: started.interruption?.approvalId,
        decision: "approve",
        payload: started.interruption?.payload ?? {},
        subject: "SITE_CONFIG",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "SITE_CONFIG_REVIEW",
    });

    expect(actionExecutor.calls).toEqual([
      {
        action: "UPDATE_SITE_ANNOUNCEMENT",
        actor: {
          id: "admin-1",
          login: "adrian",
        },
        findingIds: [],
        payload: {
          announcementId: "announcement-1",
          isEnabled: false,
        },
        subject: "SITE_CONFIG",
      },
    ]);
    expect(resumed.interruption).toBeNull();
    expect(resumed.output).toMatchObject({
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
    });
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.summary).toContain("管理员已确认继续执行。");
    expect(resumed.summary).toContain("已执行审批写操作：成功 1 项，失败 0 项。");
  });

  it("marks a started workflow as failed when a graph node throws", async () => {
    const repository = new RecordingAdminAgentRepository({
      todayComments: [createComment("comment-1", "你是不是脑残")],
    });
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble("not-json"),
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    await expect(
      runner.startWorkflow({
        startedByUserId: "user-1",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).rejects.toThrow("Comment analysis response did not contain JSON.");

    expect(repository.failedRuns).toEqual([
      {
        errorMessage: "Comment analysis response did not contain JSON.",
        id: repository.createdRuns[0]?.id,
      },
    ]);
    await expect(
      repository.findRunById(repository.createdRuns[0]?.id ?? ""),
    ).resolves.toMatchObject({
      errorMessage: "Comment analysis response did not contain JSON.",
      status: "FAILED",
    });
  });

  it("orchestrates multiple backend Agent child tasks without exposing internal orchestration details", async () => {
    const repository = new RecordingAdminAgentRepository();
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        summary: "规划执行评论治理和审计分析。",
        tasks: [
          {
            input: {
              scope: "today",
            },
            reason: "检查今日评论风险。",
            taskName: "comment_moderation_analysis",
          },
          {
            input: {
              search: "comment",
            },
            reason: "复核最近评论治理审计记录。",
            taskName: "audit_review",
          },
        ],
      }),
    );
    const auditLogs = new RecordingListAdminOperationLogsUseCase([]);
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      auditLogs as unknown as ListAdminOperationLogsUseCase,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        goal: "帮我检查评论和审计日志",
      },
      startedByUserId: "user-1",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const parentRunId = repository.createdRuns[0]?.id;

    expect(repository.createdRuns).toMatchObject([
      {
        input: {
          requestedAt: expect.any(String),
          startReason: "MANUAL",
          workflowInput: {
            goal: "帮我检查评论和审计日志",
          },
        },
        metadata: {
          graph: "multiTaskOrchestrationWorkflow",
          requestedAt: expect.any(String),
          startReason: "MANUAL",
        },
        parentRunId: null,
        parentRunRelation: null,
        startedByUserId: "user-1",
        type: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
      {
        input: {
          requestedAt: expect.any(String),
          startReason: "CHAT_INTENT",
          workflowInput: {
            scope: "today",
          },
        },
        parentRunId,
        startedByUserId: "user-1",
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
      {
        input: {
          requestedAt: expect.any(String),
          startReason: "CHAT_INTENT",
          workflowInput: {
            search: "comment",
          },
        },
        parentRunId,
        startedByUserId: "user-1",
        type: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
    expect(repository.nodeUpdates.map((item) => item.node)).toEqual([
      "plan_multi_task",
      "run_child_tasks",
      "load_comments",
      "analyze_comments",
      "persist_findings",
      "apply_approval",
      "complete",
      "load_audit_logs",
      "analyze_audit_logs",
      "complete_audit_review",
      "complete_multi_task",
    ]);
    expect(result).toMatchObject({
      interruption: null,
      output: {
        childResults: [
          {
            interruptionKind: null,
            status: "COMPLETED",
            workflowName: "COMMENT_MODERATION_ANALYSIS",
          },
          {
            interruptionKind: null,
            status: "COMPLETED",
            workflowName: "AUDIT_REVIEW",
          },
        ],
        plannedTaskCount: 2,
      },
      run: {
        status: "COMPLETED",
        type: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
      summary: expect.stringContaining("完成 2 个"),
    });
    expect(auditLogs.calls).toEqual([
      {
        action: undefined,
        actorLogin: undefined,
        page: 1,
        pageSize: 30,
        search: "comment",
      },
    ]);
  });

  it("reuses existing multi-task child runs when the child-task node is replayed", async () => {
    const repository = new RecordingAdminAgentRepository();
    const auditLogs = new RecordingListAdminOperationLogsUseCase([]);
    await repository.createRun({
      id: "parent-run",
      input: { goal: "复核审计日志" },
      metadata: null,
      parentRunId: null,
      parentRunRelation: null,
      startedByUserId: "user-1",
      threadId: "parent-run",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      createChatCompletionClientDouble("{}"),
      createConfigService(),
      auditLogs as unknown as ListAdminOperationLogsUseCase,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );
    const state = {
      approval: null,
      childResults: [],
      input: { goal: "复核审计日志" },
      output: null,
      plan: [
        {
          input: {
            search: "comment",
          },
          reason: "复核最近评论治理审计记录。",
          workflowName: "AUDIT_REVIEW" as const,
        },
      ],
      runId: "parent-run",
      startedByUserId: "user-1",
      summary: "已规划 1 个 Agent 业务处理。",
    };
    const runChildTasks = (
      runner as unknown as {
        runChildTasks(inputState: typeof state): Promise<{
          childResults: Array<{
            runId: string;
            status: string;
            workflowName: string;
          }>;
        }>;
      }
    ).runChildTasks.bind(runner);

    const first = await runChildTasks(state);
    const second = await runChildTasks(state);

    const childRuns = repository.createdRuns.filter((run) => run.parentRunId === "parent-run");
    expect(childRuns).toHaveLength(1);
    expect(childRuns[0]).toMatchObject({
      dedupeKey: expect.stringMatching(/^multi-task-child:parent-run:AUDIT_REVIEW:/),
      parentRunRelation: "CHILD_TASK",
      workflowName: "AUDIT_REVIEW",
    });
    expect(first.childResults).toMatchObject([
      {
        status: "COMPLETED",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
    expect(second.childResults).toMatchObject([
      {
        runId: first.childResults[0]?.runId,
        status: "COMPLETED",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
  });

  it("can pause multi-task orchestration for plan approval before starting child tasks", async () => {
    const repository = new RecordingAdminAgentRepository();
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        summary: "规划执行评论治理和审计分析。",
        tasks: [
          {
            input: {
              scope: "today",
            },
            reason: "检查今日评论风险。",
            taskName: "comment_moderation_analysis",
          },
          {
            input: {
              search: "comment",
            },
            reason: "复核最近评论治理审计记录。",
            taskName: "audit_review",
          },
        ],
      }),
    );
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const started = await runner.startWorkflow({
      input: {
        approvalMode: "required",
        goal: "帮我检查评论和审计日志",
      },
      startedByUserId: "user-1",
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
            expect.objectContaining({
              workflowName: "AUDIT_REVIEW",
            }),
          ],
        },
        subject: "MULTI_TASK",
      },
      run: {
        status: "WAITING_FOR_APPROVAL",
      },
    });
    expect(repository.createdRuns).toHaveLength(1);

    if (started.interruption?.kind !== "ADMIN_AGENT_APPROVAL") {
      throw new Error("Expected multi-task approval interruption.");
    }

    const deferResume = started.interruption.options.find(
      (option) => option.id === "defer",
    )?.resume;

    if (!deferResume) {
      throw new Error("Expected defer resume option.");
    }

    const resumed = await runner.resumeWorkflow({
      actor: {
        id: "admin-1",
        login: "adrian",
      },
      resume: deferResume,
      threadId: started.run.threadId ?? started.run.id,
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });

    expect(resumed.interruption).toBeNull();
    expect(resumed.output).toMatchObject({
      childResults: [],
      plannedTaskCount: 2,
    });
    expect(resumed.run.status).toBe("COMPLETED");
    expect(resumed.summary).toContain("管理员选择暂不启动子任务");
    expect(repository.createdRuns).toHaveLength(1);
  });

  it("does not refresh active multi-task orchestration runs", async () => {
    const repository = new RecordingAdminAgentRepository();
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        summary: "规划执行评论治理和审计分析。",
        tasks: [
          {
            input: {
              scope: "today",
            },
            reason: "检查今日评论风险。",
            taskName: "comment_moderation_analysis",
          },
        ],
      }),
    );
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      undefined,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const started = await runner.startWorkflow({
      input: {
        approvalMode: "required",
        goal: "帮我检查评论",
      },
      startedByUserId: "user-1",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });

    expect(started.run.status).toBe("WAITING_FOR_APPROVAL");

    const runningTransitionCount = repository.runningTransitions.length;

    await expect(
      runner.refreshWorkflow({
        runId: started.run.id,
        startedByUserId: "user-2",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      }),
    ).rejects.toThrow(
      `Multi-task orchestration run cannot be refreshed while WAITING_FOR_APPROVAL: ${started.run.id}`,
    );
    expect(repository.runningTransitions).toHaveLength(runningTransitionCount);
  });

  it("keeps multi-task orchestration running when one child task fails", async () => {
    const repository = new RecordingAdminAgentRepository();
    const llm = createChatCompletionClientDouble(
      JSON.stringify({
        summary: "规划执行文章巡检和审计分析。",
        tasks: [
          {
            input: {
              status: "DRAFT",
            },
            reason: "检查草稿文章。",
            taskName: "article_assistance",
          },
          {
            input: {
              search: "comment",
            },
            reason: "复核最近评论治理审计记录。",
            taskName: "audit_review",
          },
        ],
      }),
    );
    const auditLogs = new RecordingListAdminOperationLogsUseCase([]);
    const runner = new LangGraphAdminAgentWorkflowRunner(
      repository,
      new RecordingAdminAgentWorkflowActionExecutor(),
      llm,
      createConfigService(),
      auditLogs as unknown as ListAdminOperationLogsUseCase,
      undefined,
      undefined,
      undefined,
      {
        checkpointer: new MemorySaver(),
      },
    );

    const result = await runner.startWorkflow({
      input: {
        goal: "帮我检查文章和审计日志",
      },
      startedByUserId: "user-1",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });

    expect(repository.failedRuns).toEqual([
      {
        errorMessage: "Article assistance workflow requires ListAdminArticlesUseCase.",
        id: repository.createdRuns[1]?.id,
      },
    ]);
    expect(repository.createdRuns).toMatchObject([
      {
        type: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
      {
        parentRunId: repository.createdRuns[0]?.id,
        type: "ARTICLE_ASSISTANCE",
        workflowName: "ARTICLE_ASSISTANCE",
      },
      {
        parentRunId: repository.createdRuns[0]?.id,
        type: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      },
    ]);
    expect(repository.nodeUpdates.map((item) => item.node)).toEqual([
      "plan_multi_task",
      "run_child_tasks",
      "load_articles",
      "load_audit_logs",
      "analyze_audit_logs",
      "complete_audit_review",
      "complete_multi_task",
    ]);
    expect(result).toMatchObject({
      interruption: null,
      output: {
        childResults: [
          {
            errorMessage: "Article assistance workflow requires ListAdminArticlesUseCase.",
            output: null,
            runId: repository.createdRuns[1]?.id,
            status: "FAILED",
            workflowName: "ARTICLE_ASSISTANCE",
          },
          {
            errorMessage: null,
            status: "COMPLETED",
            workflowName: "AUDIT_REVIEW",
          },
        ],
        plannedTaskCount: 2,
      },
      run: {
        status: "COMPLETED",
        type: "MULTI_TASK_ORCHESTRATION",
      },
      summary: expect.stringContaining("失败 1 个"),
    });
  });

  it("drops LLM findings that do not target provided comments", () => {
    expect(
      parseCommentAnalysisResponse(
        JSON.stringify({
          findings: [
            {
              category: "ABUSE",
              confidence: 1,
              evidence: ["bad"],
              proposedAction: "HIDE_COMMENT",
              reason: "bad",
              severity: "HIGH",
              targetId: "unknown-comment",
            },
          ],
          summary: "done",
        }),
        [createComment("comment-1")],
      ),
    ).toEqual({
      findings: [],
      summary: "done",
    });
  });
});

class RecordingAdminAgentRepository implements AdminAgentRepository {
  completedRuns: Array<{ id: string; output: Record<string, unknown> | null; summary: string }> =
    [];
  createdFindings: AdminAgentFindingDraft[] = [];
  createdRuns: Array<Parameters<AdminAgentRepository["createRun"]>[0]> = [];
  failedRuns: Array<{ errorMessage: string; id: string }> = [];
  interruptedRuns: Array<{ id: string; node: string; summary: string }> = [];
  nodeUpdates: Array<{ id: string; node: string }> = [];
  runningTransitions: Array<{ id: string; resumed: boolean }> = [];
  workflowEvents: Array<Parameters<AdminAgentRepository["createWorkflowEvent"]>[0]> = [];
  private readonly runs = new Map<string, AdminAgentRun>();
  private readonly findings = new Map<string, AdminAgentFinding>();
  private readonly actionExecutions = new Map<string, AdminAgentWorkflowActionExecution>();

  constructor(
    private readonly input: {
      pendingFindings?: AdminAgentFinding[];
      recentComments?: AdminAgentCommentForAnalysis[];
      todayComments?: AdminAgentCommentForAnalysis[];
    } = {},
  ) {}

  async createRun(input: Parameters<AdminAgentRepository["createRun"]>[0]) {
    this.createdRuns.push(input);
    const run = createRun({
      dedupeKey: input.dedupeKey ?? null,
      id: input.id ?? `run-${this.createdRuns.length}`,
      input: input.input,
      metadata: input.metadata ?? null,
      parentRunId: input.parentRunId ?? null,
      parentRunRelation: input.parentRunRelation ?? null,
      startedByUserId: input.startedByUserId,
      threadId: input.threadId ?? input.id ?? null,
      type: input.type,
      workflowName: input.workflowName,
    });
    this.runs.set(run.id, run);
    await this.createWorkflowEvent(
      createAdminAgentWorkflowRunCreatedEvent({
        dedupeKey: run.dedupeKey,
        input: run.input,
        metadata: run.metadata,
        parentRunId: run.parentRunId,
        parentRunRelation: run.parentRunRelation,
        runId: run.id,
        workflowName: run.workflowName,
      }),
    );
    return run;
  }

  async createWorkflowEvent(input: Parameters<AdminAgentRepository["createWorkflowEvent"]>[0]) {
    this.workflowEvents.push(input);
    return {
      createdAt: new Date("2026-07-04T10:00:00.000Z"),
      id: `event-${this.workflowEvents.length}`,
      node: input.node ?? null,
      payload: input.payload ?? null,
      runId: input.runId,
      summary: input.summary ?? null,
      type: input.type,
    };
  }

  async ensureWorkflowActionExecution(
    input: Parameters<AdminAgentRepository["ensureWorkflowActionExecution"]>[0],
  ) {
    const key = `${input.runId}:${input.approvalId}`;
    const existing = this.actionExecutions.get(key);

    if (existing) {
      if (existing.status === "SUCCEEDED") {
        return {
          claimStatus: "SUCCEEDED" as const,
          execution: existing,
        };
      }

      if (
        isAdminAgentWorkflowActionExecutionInProgress(
          existing,
          new Date("2026-07-04T10:01:00.000Z"),
        )
      ) {
        return {
          claimStatus: "IN_PROGRESS" as const,
          execution: existing,
        };
      }

      const execution = this.updateWorkflowActionExecution(existing.id, {
        errorMessage: null,
        result: null,
        status: "RUNNING",
      });

      return {
        claimStatus: "CLAIMED" as const,
        execution,
      };
    }

    const execution = {
      action: input.action,
      approvalId: input.approvalId,
      createdAt: new Date("2026-07-04T10:00:00.000Z"),
      errorMessage: null,
      id: `action-execution-${this.actionExecutions.size + 1}`,
      payload: input.payload,
      result: null,
      runId: input.runId,
      status: "RUNNING" as const,
      subject: input.subject,
      updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    };

    this.actionExecutions.set(key, execution);
    return {
      claimStatus: "CLAIMED" as const,
      execution,
    };
  }

  async markWorkflowActionExecutionSucceeded(
    id: string,
    result: Parameters<AdminAgentRepository["markWorkflowActionExecutionSucceeded"]>[1],
  ) {
    return this.updateWorkflowActionExecution(id, {
      errorMessage: null,
      result,
      status: "SUCCEEDED",
    });
  }

  async markWorkflowActionExecutionFailed(id: string, errorMessage: string) {
    return this.updateWorkflowActionExecution(id, {
      errorMessage,
      status: "FAILED",
    });
  }

  async ensureDecisionEffect(): Promise<
    Awaited<ReturnType<AdminAgentRepository["ensureDecisionEffect"]>>
  > {
    throw new Error("not used");
  }

  async listRepairableDecisionEffects(): Promise<
    Awaited<ReturnType<AdminAgentRepository["listRepairableDecisionEffects"]>>
  > {
    throw new Error("not used");
  }

  async markDecisionEffectSucceeded(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markDecisionEffectSucceeded"]>>
  > {
    throw new Error("not used");
  }

  async markDecisionEffectFailed(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markDecisionEffectFailed"]>>
  > {
    throw new Error("not used");
  }

  async findRunById(id: string) {
    return this.runs.get(id) ?? null;
  }

  async findRunByThreadId(threadId: string) {
    return [...this.runs.values()].find((run) => run.threadId === threadId) ?? null;
  }

  async listRuns(filters: Parameters<AdminAgentRepository["listRuns"]>[0]) {
    const data = [...this.runs.values()].filter(
      (run) =>
        (!filters.status || run.status === filters.status) &&
        (!filters.workflowName || run.workflowName === filters.workflowName) &&
        (!filters.parentRunId || run.parentRunId === filters.parentRunId) &&
        (!filters.parentRunRelation || run.parentRunRelation === filters.parentRunRelation),
    );

    return {
      data,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: data.length,
        totalPages: Math.ceil(data.length / filters.pageSize),
      },
    };
  }

  async listWorkflowEventsByRunId(runId: string) {
    return this.workflowEvents
      .filter((event) => event.runId === runId)
      .map((event, index) => ({
        createdAt: new Date("2026-07-04T10:00:00.000Z"),
        id: `event-${index + 1}`,
        node: event.node ?? null,
        payload: event.payload ?? null,
        runId: event.runId,
        summary: event.summary ?? null,
        type: event.type,
      }));
  }

  async listLatestWorkflowEventsByRunIds(runIds: string[]) {
    const latestEvents = await Promise.all(
      runIds.map(async (runId) => {
        const events = await this.listWorkflowEventsByRunId(runId);
        return events.at(-1) ?? null;
      }),
    );

    return latestEvents.filter((event): event is NonNullable<typeof event> => Boolean(event));
  }

  async markRunRunning(id: string, options: { resumed?: boolean } = {}) {
    const run = this.requireRun(id);
    const attemptCount = run.attemptCount + 1;

    this.runningTransitions.push({ id, resumed: options.resumed === true });
    const updated = this.updateRun(id, {
      attemptCount,
      lastResumedAt: options.resumed ? new Date("2026-07-04T10:05:00.000Z") : null,
      status: "RUNNING",
    });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowRunAttemptEvent({
        attemptCount,
        resumed: options.resumed === true,
        runId: id,
        workflowName: run.workflowName,
      }),
    );
    return updated;
  }

  async markRunNode(
    id: string,
    currentNode: Parameters<AdminAgentRepository["markRunNode"]>[1],
    metadata?: Record<string, unknown>,
  ) {
    const run = this.requireRun(id);

    this.nodeUpdates.push({ id, node: currentNode });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowNodeStartedEvent({
        node: currentNode,
        payload: metadata ?? null,
        runId: id,
        workflowName: run.workflowName,
      }),
    );
    this.updateRun(id, { currentNode });
  }

  async markRunInterrupted(
    id: string,
    interruption: Record<string, unknown>,
    summary: string,
    options: Parameters<AdminAgentRepository["markRunInterrupted"]>[3] = {},
  ) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    const currentNode = options.approvalNode ?? "human_approval";

    this.interruptedRuns.push({ id, node: currentNode, summary });
    const updated = this.updateRun(id, {
      currentNode,
      interruption,
      status: "WAITING_FOR_APPROVAL",
      summary,
    });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowInterruptedEvent({
        approvalNode: currentNode,
        interruption,
        runId: id,
        summary,
      }),
    );
    return updated;
  }

  async markRunWaitingForApproval(id: string, summary: string) {
    return this.updateRun(id, { status: "WAITING_FOR_APPROVAL", summary });
  }

  async completeRun(id: string, summary: string, output: Record<string, unknown> | null = null) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    this.completedRuns.push({ id, output, summary });
    const updated = this.updateRun(id, {
      currentNode: "completed",
      errorMessage: null,
      interruption: null,
      output,
      status: "COMPLETED",
      summary,
    });
    await this.createWorkflowEvent(createAdminAgentWorkflowCompletedEvent({ runId: id, summary }));
    return updated;
  }

  async cancelRun(id: string, summary: string) {
    await this.createWorkflowEvent(createAdminAgentWorkflowCancelledEvent({ runId: id, summary }));
    return this.updateRun(id, {
      currentNode: "cancelled",
      errorMessage: null,
      interruption: null,
      status: "CANCELLED",
      summary,
    });
  }

  async failRun(id: string, errorMessage: string) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    this.failedRuns.push({ errorMessage, id });
    const updated = this.updateRun(id, {
      currentNode: "failed",
      errorMessage,
      status: "FAILED",
    });
    await this.createWorkflowEvent(
      createAdminAgentWorkflowFailedEvent({ errorMessage, runId: id }),
    );
    return updated;
  }

  async findFindingById(id: string) {
    return this.findings.get(id) ?? null;
  }

  async markFindingExecuted(id: string) {
    return this.updateFinding(id, { status: "EXECUTED" });
  }

  async markFindingFailed(id: string) {
    return this.updateFinding(id, { status: "FAILED" });
  }

  async markFindingRejected(id: string) {
    return this.updateFinding(id, { status: "REJECTED" });
  }

  async markFindingRestored(id: string) {
    return this.updateFinding(id, { status: "RESTORED" });
  }

  async listTodayVisibleCommentsForAnalysis() {
    return this.input.todayComments ?? [];
  }

  async listRecentVisibleCommentsForAnalysis() {
    return this.input.recentComments ?? [];
  }

  async createFindings(runId: string, findings: AdminAgentFindingDraft[]) {
    this.createdFindings.push(...findings);
    return findings.map((finding, index) => {
      const created = createFindingFromDraft(finding, {
        id: `finding-${index + 1}`,
        runId,
      });
      this.findings.set(created.id, created);
      return created;
    });
  }

  async listPendingFindingsByTargetIds() {
    return this.input.pendingFindings ?? [];
  }

  async listFindingsByIds(ids: string[]) {
    const uniqueIds = new Set(ids);
    return [...this.findings.values()].filter((finding) => uniqueIds.has(finding.id));
  }

  async listFindingsByRunId(runId: string) {
    return [...this.findings.values()].filter((finding) => finding.runId === runId);
  }

  private updateRun(id: string, changes: Partial<AdminAgentRun>) {
    const run = this.requireRun(id);

    const updated = { ...run, ...changes };
    this.runs.set(id, updated);
    return updated;
  }

  private requireRun(id: string) {
    const run = this.runs.get(id);

    if (!run) {
      throw new Error(`Missing test run ${id}.`);
    }

    return run;
  }

  private updateFinding(id: string, changes: Partial<AdminAgentFinding>) {
    const finding = this.findings.get(id);

    if (!finding) {
      throw new Error(`Missing test finding ${id}.`);
    }

    const updated = { ...finding, ...changes };
    this.findings.set(id, updated);
    return updated;
  }

  private updateWorkflowActionExecution(
    id: string,
    changes: Partial<AdminAgentWorkflowActionExecution>,
  ) {
    const entry = [...this.actionExecutions.entries()].find(([, execution]) => execution.id === id);

    if (!entry) {
      throw new Error(`Missing test workflow action execution ${id}.`);
    }

    const [key, execution] = entry;
    const updated = {
      ...execution,
      ...changes,
      updatedAt: new Date("2026-07-04T10:01:00.000Z"),
    };

    this.actionExecutions.set(key, updated);
    return updated;
  }
}

class RecordingListAdminOperationLogsUseCase {
  calls: Array<Parameters<ListAdminOperationLogsUseCase["execute"]>[0]> = [];

  constructor(private readonly logs: AdminOperationLog[] = []) {}

  async execute(input: Parameters<ListAdminOperationLogsUseCase["execute"]>[0]) {
    const filters = input ?? {};
    this.calls.push(filters);

    return {
      data: this.logs,
      pagination: {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? this.logs.length,
        totalItems: this.logs.length,
        totalPages: 1,
      },
    };
  }
}

class RecordingListAdminArticlesUseCase {
  calls: Array<Parameters<ListAdminArticlesUseCase["execute"]>[0]> = [];

  constructor(private readonly articles: AdminArticleListItem[] = []) {}

  async execute(input: Parameters<ListAdminArticlesUseCase["execute"]>[0]) {
    const filters = input ?? {};
    this.calls.push(filters);

    return {
      data: this.articles,
      pagination: {
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? this.articles.length,
        totalItems: this.articles.length,
        totalPages: 1,
      },
    };
  }
}

class RecordingGetAdminArticleByIdUseCase {
  calls: string[] = [];

  constructor(private readonly articlesById: Record<string, AdminArticleDetail>) {}

  async execute(id: string) {
    this.calls.push(id);
    const article = this.articlesById[id];

    if (!article) {
      throw new Error(`Missing test article ${id}.`);
    }

    return article;
  }
}

class RecordingGetAdminSiteConfigUseCase {
  calls: Array<Record<string, never>> = [];

  constructor(
    private readonly siteConfig: Awaited<ReturnType<GetAdminSiteConfigUseCase["execute"]>>,
  ) {}

  async execute() {
    this.calls.push({});
    return this.siteConfig;
  }
}

class RecordingAdminAgentWorkflowActionExecutor implements AdminAgentWorkflowActionExecutor {
  calls: Array<{
    action: string;
    actor: Parameters<AdminAgentWorkflowActionExecutor["executeAction"]>[0]["actor"];
    findingIds: string[];
    payload: Record<string, unknown>;
    subject: string;
  }> = [];

  constructor(
    private readonly result: Awaited<
      ReturnType<AdminAgentWorkflowActionExecutor["executeAction"]>
    > = {
      appliedCount: 0,
      failedCount: 0,
      results: [],
    },
  ) {}

  async executeAction(input: Parameters<AdminAgentWorkflowActionExecutor["executeAction"]>[0]) {
    this.calls.push({
      action: input.action,
      actor: input.actor,
      findingIds: Array.isArray(input.payload.findingIds)
        ? input.payload.findingIds.filter(
            (findingId): findingId is string => typeof findingId === "string",
          )
        : [],
      payload: input.payload,
      subject: input.subject,
    });

    return this.result;
  }
}

type RecordingChatCompletionClient = OpenAiCompatibleChatCompletionClient & {
  calls: Array<Parameters<OpenAiCompatibleChatCompletionClient["complete"]>[0]>;
};

function createChatCompletionClientDouble(response: string): RecordingChatCompletionClient {
  const calls: RecordingChatCompletionClient["calls"] = [];

  return {
    calls,
    async complete(input) {
      calls.push(input);
      return response;
    },
  } as unknown as RecordingChatCompletionClient;
}

function createFlakyChatCompletionClientDouble(
  outcomes: Array<Error | string>,
): RecordingChatCompletionClient {
  const calls: RecordingChatCompletionClient["calls"] = [];
  const queue = [...outcomes];

  return {
    calls,
    async complete(input) {
      calls.push(input);
      const outcome = queue.shift();

      if (outcome instanceof Error) {
        throw outcome;
      }

      if (typeof outcome === "string") {
        return outcome;
      }

      throw new Error("No chat completion response configured.");
    },
  } as unknown as RecordingChatCompletionClient;
}

function createConfigService() {
  return {
    get() {
      return "";
    },
  } as never;
}

function createComment(id: string, body = "评论内容"): AdminAgentCommentForAnalysis {
  return {
    article: {
      id: "article-1",
      slug: "article",
      title: "文章",
    },
    author: {
      id: "user-1",
      login: "adrian",
      name: "Adrian",
    },
    body,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    id,
    parent: null,
    status: "VISIBLE",
  };
}

function createFindingFromDraft(
  draft: AdminAgentFindingDraft,
  overrides: Partial<AdminAgentFinding> = {},
): AdminAgentFinding {
  return {
    category: draft.category,
    confidence: draft.confidence,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    evidence: draft.evidence,
    executedAt: null,
    id: "finding-1",
    proposedAction: draft.proposedAction,
    reason: draft.reason,
    runId: "run-1",
    severity: draft.severity,
    status: "PENDING",
    target: null,
    targetId: draft.targetId,
    targetType: draft.targetType,
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    ...overrides,
  };
}

function createAuditLog(overrides: Partial<AdminOperationLog> = {}): AdminOperationLog {
  return {
    action: "SITE_SETTINGS_UPDATED",
    actorLogin: "adrian",
    actorUserId: "admin-1",
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    id: "audit-log-1",
    ipAddress: "127.0.0.1",
    metadata: null,
    resourceId: "resource-1",
    resourceType: "site_settings",
    summary: "Updated site settings",
    userAgent: "vitest",
    ...overrides,
  };
}

function createAdminArticleDetail(overrides: Partial<AdminArticleDetail> = {}): AdminArticleDetail {
  return {
    aiSummaryStatus: "UNQUEUED",
    category: {
      name: "工程",
      slug: "engineering",
    },
    commentCount: 0,
    coverImageUrl: null,
    createdAt: new Date("2026-07-04T09:00:00.000Z"),
    description: "文章描述",
    id: "article-1",
    markdown: "# 文章\n\n正文内容",
    origin: "ORIGINAL",
    publishedAt: null,
    readingMinutes: 1,
    slug: "article",
    status: "DRAFT",
    source: null,
    tags: [
      {
        name: "Agent",
        slug: "agent",
      },
    ],
    title: "文章",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    wordCount: 120,
    ...overrides,
  };
}

function createRun(overrides: Partial<AdminAgentRun> = {}): AdminAgentRun {
  return {
    attemptCount: 0,
    createdAt: new Date("2026-07-04T10:00:00.000Z"),
    currentNode: null,
    dedupeKey: null,
    errorMessage: null,
    id: "run-1",
    input: {},
    interruption: null,
    lastResumedAt: null,
    metadata: null,
    output: null,
    parentRunId: null,
    parentRunRelation: null,
    startedByUserId: null,
    status: "PENDING",
    summary: null,
    threadId: null,
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}
