import { describe, expect, it, vi } from "vitest";
import type {
  AdminAgentRepository,
  CreateAdminAgentRunInput,
  ListAdminAgentRunsFilters,
} from "../domain/admin-agent.repository";
import type {
  AdminAgentFinding,
  AdminAgentFindingDraft,
} from "../domain/admin-agent-finding.entity";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import type {
  AdminAgentWorkflowDefinition,
  AdminAgentWorkflowRegistry,
  ResumeAdminAgentWorkflowInput,
  StartAdminAgentWorkflowInput,
} from "../domain/admin-agent-workflow-definition";
import type { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import { listAdminAgentWorkflowMetadata } from "../domain/admin-agent-workflow-metadata";
import type { AdminAgentWorkflowResult } from "../domain/admin-agent-workflow-runner";
import { AdminAgentWorkflowInvalidResumeError } from "../domain/admin-agent-workflow-runner";
import {
  AdminAgentWorkflowActiveRunRetryError,
  AdminAgentWorkflowNotFoundError,
  AdminAgentWorkflowBranchUnavailableError,
  AdminAgentWorkflowRefreshUnavailableError,
  AdminAgentWorkflowResumeUnavailableError,
  AdminAgentWorkflowUnsupportedControlActionError,
  AdminAgentWorkflowUnsupportedError,
  ManageAdminAgentWorkflowsUseCase,
  normalizeListAdminAgentWorkflowRunsInput,
} from "./manage-admin-agent-workflows.use-case";
import type { RepairAdminAgentDecisionEffectsUseCase } from "./repair-admin-agent-decision-effects.use-case";

describe("ManageAdminAgentWorkflowsUseCase", () => {
  it("lists workflow runs with normalized pagination and filters", async () => {
    const repository = new RecordingAdminAgentRepository([
      createRun({
        id: "run-1",
        status: "FAILED",
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
      createRun({
        id: "run-2",
        status: "COMPLETED",
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
      createRun({
        id: "child-run",
        parentRunId: "parent-run",
        status: "FAILED",
        type: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ]);
    repository.workflowEvents.push(
      {
        runId: "run-1",
        summary: "旧进度",
        type: "RUN_CREATED",
      },
      {
        runId: "run-1",
        summary: "最新失败进度",
        type: "FAILED",
      },
      {
        runId: "run-2",
        summary: "不在本页过滤结果中",
        type: "COMPLETED",
      },
    );
    const useCase = createUseCase(repository);

    const result = await useCase.listRuns({
      page: 0,
      pageSize: 100,
      rootOnly: true,
      status: "FAILED",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(result).toMatchObject({
      data: [{ id: "run-1" }],
      pagination: {
        page: 1,
        pageSize: 50,
      },
    });
    expect(result.latestEventsByRunId.get("run-1")).toMatchObject({
      runId: "run-1",
      summary: "最新失败进度",
      type: "FAILED",
    });
    expect(result.latestEventsByRunId.has("run-2")).toBe(false);
    expect(repository.lastListFilters).toEqual({
      page: 1,
      pageSize: 50,
      parentRunRelation: undefined,
      rootOnly: true,
      status: "FAILED",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
  });

  it("normalizes public relation filters to parent run relations", () => {
    expect(
      normalizeListAdminAgentWorkflowRunsInput({
        parentRunId: " parent-run ",
        parentRunRelation: "CHILD_TASK",
      }),
    ).toMatchObject({
      parentRunId: "parent-run",
      parentRunRelation: "CHILD_TASK",
    });
  });

  it("starts registered workflows through the generic control plane", async () => {
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const recordAdminOperation = createRecordAdminOperation();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository(),
      workflowRegistry,
      recordAdminOperation,
    );

    await useCase.startWorkflow({
      actor: {
        id: "admin-1",
        login: "admin",
      },
      input: {
        scope: "today",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      startedByUserId: "admin-1",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });

    expect(workflowRegistry.startCalls).toEqual([
      {
        input: {
          scope: "today",
        },
        parentRunId: undefined,
        startedByUserId: "admin-1",
        startReason: "MANUAL",
      },
    ]);
    expect(recordAdminOperation.execute).toHaveBeenCalledWith({
      action: "ADMIN_AGENT_TASK_STARTED",
      actor: {
        id: "admin-1",
        login: "admin",
      },
      metadata: {
        source: "admin_agent",
        status: "COMPLETED",
        taskTitle: "评论治理分析",
        taskName: "comment_moderation_analysis",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      resourceId: "run-1",
      resourceType: "ADMIN_AGENT_TASK",
    });
  });

  it("records explicit task control operations as audit entries", async () => {
    const sourceRun = createRun({
      id: "paused-run",
      status: "WAITING_FOR_APPROVAL",
      threadId: "paused-thread",
    });
    const recordAdminOperation = createRecordAdminOperation();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([sourceRun]),
      new RecordingAdminAgentWorkflowRegistry(),
      recordAdminOperation,
    );

    await useCase.controlRun({
      action: "branch",
      actor: {
        id: "admin-1",
        login: "admin",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(recordAdminOperation.execute).toHaveBeenCalledWith({
      action: "ADMIN_AGENT_TASK_CONTROLLED",
      actor: {
        id: "admin-1",
        login: "admin",
      },
      metadata: {
        action: "branch",
        source: "admin_agent",
        status: "COMPLETED",
        taskTitle: "文章协作",
        taskName: "article_assistance",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      resourceId: sourceRun.id,
      resourceType: "ADMIN_AGENT_TASK",
    });
  });

  it("records task control operations on the source workflow event stream", async () => {
    const sourceRun = createRun({
      id: "paused-run",
      status: "WAITING_FOR_APPROVAL",
      threadId: "paused-thread",
    });
    const repository = new RecordingAdminAgentRepository([sourceRun]);
    const useCase = createUseCase(repository, new RecordingAdminAgentWorkflowRegistry());

    const branched = await useCase.controlRun({
      action: "branch",
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(repository.workflowEvents).toContainEqual(
      expect.objectContaining({
        payload: {
          action: "branch",
          resultRunId: branched.run.id,
          resultStatus: branched.run.status,
        },
        runId: sourceRun.id,
        summary: "文章协作已执行「另开处理」操作。",
        type: "CONTROLLED",
      }),
    );
    expect(branched.events).toContainEqual(
      expect.objectContaining({
        runId: sourceRun.id,
        summary: "文章协作已执行「另开处理」操作。",
        type: "CONTROLLED",
      }),
    );
  });

  it("registers every supported business workflow in the generic control plane", async () => {
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository(), workflowRegistry);

    for (const metadata of listAdminAgentWorkflowMetadata()) {
      await useCase.startWorkflow({
        startedByUserId: "admin-1",
        workflowName: metadata.workflowName,
      });
    }

    expect(workflowRegistry.startedWorkflowNames).toEqual([
      "COMMENT_MODERATION_ANALYSIS",
      "ARTICLE_ASSISTANCE",
      "SITE_CONFIG_REVIEW",
      "AUDIT_REVIEW",
      "MULTI_TASK_ORCHESTRATION",
    ]);
  });

  it("retries every supported business workflow through the same control plane", async () => {
    const runs = listAdminAgentWorkflowMetadata().map((metadata) =>
      createRun({
        id: `${metadata.taskName}-failed-run`,
        input: createWorkflowInputEnvelope({ taskName: metadata.taskName }),
        status: "FAILED",
        type: metadata.runType,
        workflowName: metadata.workflowName,
      }),
    );
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository(runs), workflowRegistry);

    for (const run of runs) {
      await useCase.controlRun({
        action: "retry",
        runId: run.id,
        startedByUserId: "admin-1",
      });
    }

    expect(workflowRegistry.startedWorkflowNames).toEqual(
      listAdminAgentWorkflowMetadata().map((metadata) => metadata.workflowName),
    );
    expect(workflowRegistry.startCalls).toEqual(
      runs.map((run) => ({
        input: getWorkflowInputFromEnvelope(run.input),
        parentRunId: run.id,
        startedByUserId: "admin-1",
        startReason: "RETRY",
      })),
    );
  });

  it("branches every branchable paused workflow from its persisted checkpoint", async () => {
    const runs = listAdminAgentWorkflowMetadata()
      .filter((metadata) => metadata.supportsBranch)
      .map((metadata) =>
        createRun({
          id: `${metadata.taskName}-waiting-run`,
          status: "WAITING_FOR_APPROVAL",
          threadId: `${metadata.taskName}-thread`,
          type: metadata.runType,
          workflowName: metadata.workflowName,
        }),
      );
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository(runs), workflowRegistry);

    for (const run of runs) {
      await useCase.controlRun({
        action: "branch",
        runId: run.id,
        startedByUserId: "admin-1",
      });
    }

    expect(workflowRegistry.branchCalls).toEqual(
      runs.map((run) => ({
        parentRunId: run.id,
        sourceThreadId: run.threadId,
        startedByUserId: "admin-1",
      })),
    );
  });

  it("cancels paused business workflows and keeps them retryable", async () => {
    const sourceRun = createRun({
      id: "paused-run",
      input: createWorkflowInputEnvelope({}),
      status: "WAITING_FOR_APPROVAL",
      summary: "等待管理员确认。",
      threadId: "paused-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const repository = new RecordingAdminAgentRepository([sourceRun]);
    const useCase = createUseCase(repository, workflowRegistry);

    const cancelled = await useCase.controlRun({
      action: "cancel",
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(cancelled.run).toMatchObject({
      id: sourceRun.id,
      status: "CANCELLED",
      summary: "已取消文章协作。",
    });
    expect(repository.workflowEvents).toEqual([
      expect.objectContaining({
        node: "cancelled",
        runId: sourceRun.id,
        summary: "已取消文章协作。",
        type: "CANCELLED",
      }),
      expect.objectContaining({
        payload: {
          action: "cancel",
          resultRunId: sourceRun.id,
          resultStatus: "CANCELLED",
        },
        runId: sourceRun.id,
        summary: "文章协作已执行「取消」操作。",
        type: "CONTROLLED",
      }),
    ]);

    await useCase.controlRun({
      action: "retry",
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.startCalls).toEqual([
      {
        input: {},
        parentRunId: sourceRun.id,
        startedByUserId: "admin-1",
        startReason: "RETRY",
      },
    ]);
  });

  it("refreshes completed multi-task orchestration from its persisted parent run", async () => {
    const sourceRun = createRun({
      id: "multi-task-run",
      status: "COMPLETED",
      threadId: "multi-task-thread",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository([sourceRun]), workflowRegistry);

    await useCase.controlRun({
      action: "refresh",
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.refreshCalls).toEqual([
      {
        runId: sourceRun.id,
        startedByUserId: "admin-1",
      },
    ]);
    expect(workflowRegistry.startCalls).toEqual([]);
    expect(workflowRegistry.branchCalls).toEqual([]);
  });

  it("controls retries through business action names", async () => {
    const sourceRun = createRun({
      id: "failed-run",
      input: createWorkflowInputEnvelope({ scope: "today" }),
      status: "FAILED",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository([sourceRun]), workflowRegistry);

    await useCase.controlRun({
      action: "retry",
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.startCalls).toEqual([
      {
        input: { scope: "today" },
        parentRunId: sourceRun.id,
        startedByUserId: "admin-1",
        startReason: "RETRY",
      },
    ]);
    expect(workflowRegistry.branchCalls).toEqual([]);
  });

  it("controls branch through business action names", async () => {
    const sourceRun = createRun({
      id: "paused-run",
      status: "WAITING_FOR_APPROVAL",
      threadId: "paused-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository([sourceRun]), workflowRegistry);

    await useCase.controlRun({
      action: "branch",
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.branchCalls).toEqual([
      {
        parentRunId: sourceRun.id,
        sourceThreadId: sourceRun.threadId,
        startedByUserId: "admin-1",
      },
    ]);
    expect(workflowRegistry.startCalls).toEqual([]);
  });

  it("resumes every approval workflow through its stored thread id", async () => {
    const runs = listAdminAgentWorkflowMetadata()
      .filter((metadata) => metadata.supportsHumanApproval)
      .map((metadata) =>
        createRun({
          id: `${metadata.taskName}-waiting-run`,
          status: "WAITING_FOR_APPROVAL",
          threadId: `${metadata.taskName}-thread`,
          type: metadata.runType,
          workflowName: metadata.workflowName,
        }),
      );
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository(runs), workflowRegistry);

    for (const run of runs) {
      await useCase.resumeRun({
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: {
          decision: "approve",
          runId: run.id,
        },
        runId: run.id,
      });
    }

    expect(workflowRegistry.resumeCalls).toEqual(
      runs.map((run) => ({
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: {
          decision: "approve",
          runId: run.id,
        },
        threadId: run.threadId,
      })),
    );
  });

  it("refreshes a completed multi-task parent after resuming a paused child workflow", async () => {
    const parentRun = createRun({
      id: "parent-multi-task-run",
      status: "COMPLETED",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const childRun = createRun({
      id: "child-comment-run",
      parentRunId: parentRun.id,
      parentRunRelation: "CHILD_TASK",
      status: "WAITING_FOR_APPROVAL",
      threadId: "child-comment-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, childRun]),
      workflowRegistry,
    );

    await useCase.resumeRun({
      actor: {
        id: "admin-1",
        login: "admin",
      },
      resume: {
        decision: "approve",
        runId: childRun.id,
      },
      runId: childRun.id,
    });

    expect(workflowRegistry.refreshCalls).toEqual([
      {
        runId: parentRun.id,
        startedByUserId: "admin-1",
      },
    ]);
  });

  it("does not refresh an active multi-task parent after resuming a paused child workflow", async () => {
    const parentRun = createRun({
      id: "active-parent-multi-task-run",
      status: "RUNNING",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const childRun = createRun({
      id: "child-site-run",
      parentRunId: parentRun.id,
      parentRunRelation: "CHILD_TASK",
      status: "WAITING_FOR_APPROVAL",
      threadId: "child-site-thread",
      type: "SITE_CONFIG_REVIEW",
      workflowName: "SITE_CONFIG_REVIEW",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, childRun]),
      workflowRegistry,
    );

    await useCase.resumeRun({
      actor: {
        id: "admin-1",
        login: "admin",
      },
      resume: {
        decision: "approve",
        runId: childRun.id,
      },
      runId: childRun.id,
    });

    expect(workflowRegistry.refreshCalls).toEqual([]);
  });

  it("does not refresh a multi-task parent when resuming a branch run", async () => {
    const parentRun = createRun({
      id: "parent-multi-task-run",
      status: "COMPLETED",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const branchRun = createRun({
      id: "branch-comment-run",
      parentRunId: parentRun.id,
      parentRunRelation: "BRANCH",
      status: "WAITING_FOR_APPROVAL",
      threadId: "branch-comment-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, branchRun]),
      workflowRegistry,
    );

    await useCase.resumeRun({
      actor: {
        id: "admin-1",
        login: "admin",
      },
      resume: {
        decision: "approve",
        runId: branchRun.id,
      },
      runId: branchRun.id,
    });

    expect(workflowRegistry.refreshCalls).toEqual([]);
  });

  it("refreshes a completed multi-task parent after resuming a paused retry attempt of a child workflow", async () => {
    const parentRun = createRun({
      id: "parent-multi-task-run",
      status: "COMPLETED",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const childRun = createRun({
      id: "child-comment-run",
      parentRunId: parentRun.id,
      parentRunRelation: "CHILD_TASK",
      status: "FAILED",
    });
    const retryRun = createRun({
      id: "retry-comment-run",
      parentRunId: childRun.id,
      parentRunRelation: "RETRY",
      status: "WAITING_FOR_APPROVAL",
      threadId: "retry-comment-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, childRun, retryRun]),
      workflowRegistry,
    );

    await useCase.resumeRun({
      actor: {
        id: "admin-1",
        login: "admin",
      },
      resume: {
        decision: "approve",
        runId: retryRun.id,
      },
      runId: retryRun.id,
    });

    expect(workflowRegistry.refreshCalls).toEqual([
      {
        runId: parentRun.id,
        startedByUserId: "admin-1",
      },
    ]);
  });

  it("refreshes a completed multi-task parent after cancelling a direct child workflow", async () => {
    const parentRun = createRun({
      id: "parent-multi-task-run",
      status: "COMPLETED",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const childRun = createRun({
      id: "child-comment-run",
      parentRunId: parentRun.id,
      parentRunRelation: "CHILD_TASK",
      status: "WAITING_FOR_APPROVAL",
      threadId: "child-comment-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, childRun]),
      workflowRegistry,
    );

    await useCase.controlRun({
      action: "cancel",
      runId: childRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.refreshCalls).toEqual([
      {
        runId: parentRun.id,
        startedByUserId: "admin-1",
      },
    ]);
  });

  it("refreshes a completed multi-task parent after cancelling a retry attempt of a child workflow", async () => {
    const parentRun = createRun({
      id: "parent-multi-task-run",
      status: "COMPLETED",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const childRun = createRun({
      id: "child-comment-run",
      parentRunId: parentRun.id,
      parentRunRelation: "CHILD_TASK",
      status: "FAILED",
    });
    const retryRun = createRun({
      id: "retry-comment-run",
      parentRunId: childRun.id,
      parentRunRelation: "RETRY",
      status: "RUNNING",
      threadId: "retry-comment-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, childRun, retryRun]),
      workflowRegistry,
    );

    await useCase.controlRun({
      action: "cancel",
      runId: retryRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.refreshCalls).toEqual([
      {
        runId: parentRun.id,
        startedByUserId: "admin-1",
      },
    ]);
  });

  it("does not refresh a multi-task parent after branching a direct child workflow", async () => {
    const parentRun = createRun({
      id: "parent-multi-task-run",
      status: "COMPLETED",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const childRun = createRun({
      id: "child-site-run",
      parentRunId: parentRun.id,
      parentRunRelation: "CHILD_TASK",
      status: "WAITING_FOR_APPROVAL",
      threadId: "child-site-thread",
      type: "SITE_CONFIG_REVIEW",
      workflowName: "SITE_CONFIG_REVIEW",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, childRun]),
      workflowRegistry,
    );

    await useCase.controlRun({
      action: "branch",
      runId: childRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.refreshCalls).toEqual([]);
  });

  it("rejects generic starts when the workflow registry is misconfigured", async () => {
    const useCase = createUseCase(
      new RecordingAdminAgentRepository(),
      new RecordingAdminAgentWorkflowRegistry(createWorkflowResult(), []),
    );

    await expect(
      useCase.startWorkflow({
        startedByUserId: "admin-1",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowUnsupportedError);
  });

  it("retries a failed workflow as a child run", async () => {
    const failedRun = createRun({
      id: "failed-run",
      input: createWorkflowInputEnvelope({ scope: "recentVisibleFallback" }),
      status: "FAILED",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const repairDecisionEffects = createRepairDecisionEffects();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([failedRun]),
      workflowRegistry,
      createRecordAdminOperation(),
      repairDecisionEffects,
    );

    await useCase.controlRun({
      action: "retry",
      runId: failedRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.startCalls).toEqual([
      {
        input: {
          scope: "recentVisibleFallback",
        },
        parentRunId: failedRun.id,
        startedByUserId: "admin-1",
        startReason: "RETRY",
      },
    ]);
    expect(repairDecisionEffects.execute).toHaveBeenCalledWith({ runId: "run-1" });
  });

  it("refreshes a completed multi-task parent after retrying a direct child workflow", async () => {
    const parentRun = createRun({
      id: "parent-multi-task-run",
      status: "COMPLETED",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const failedChildRun = createRun({
      id: "failed-child-run",
      input: createWorkflowInputEnvelope({ scope: "recentVisibleFallback" }),
      parentRunId: parentRun.id,
      parentRunRelation: "CHILD_TASK",
      status: "FAILED",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([parentRun, failedChildRun]),
      workflowRegistry,
    );

    await useCase.controlRun({
      action: "retry",
      runId: failedChildRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.startCalls).toEqual([
      {
        input: { scope: "recentVisibleFallback" },
        parentRunId: failedChildRun.id,
        startedByUserId: "admin-1",
        startReason: "RETRY",
      },
    ]);
    expect(workflowRegistry.refreshCalls).toEqual([
      {
        runId: parentRun.id,
        startedByUserId: "admin-1",
      },
    ]);
  });

  it("retries comment moderation from its original workflow input instead of the durable envelope", async () => {
    const failedRun = createRun({
      id: "failed-comment-run",
      input: {
        requestedAt: "2026-07-09T04:00:00.000Z",
        startReason: "CHAT_INTENT",
        workflowInput: {
          scope: "today",
        },
      },
      status: "FAILED",
      type: "COMMENT_MODERATION_TODAY",
      workflowName: "COMMENT_MODERATION_ANALYSIS",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository([failedRun]), workflowRegistry);

    await useCase.controlRun({
      action: "retry",
      runId: failedRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.startCalls).toEqual([
      {
        input: {
          scope: "today",
        },
        parentRunId: failedRun.id,
        startedByUserId: "admin-1",
        startReason: "RETRY",
      },
    ]);
  });

  it("does not retry active workflow runs", async () => {
    const activeRun = createRun({ id: "active-run", status: "WAITING_FOR_APPROVAL" });
    const useCase = createUseCase(new RecordingAdminAgentRepository([activeRun]));

    await expect(
      useCase.controlRun({
        action: "retry",
        runId: activeRun.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowActiveRunRetryError);
  });

  it("uses the task catalog allowed statuses before retrying a workflow run", async () => {
    const pendingRun = createRun({ id: "pending-run", status: "PENDING" });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([pendingRun]),
      workflowRegistry,
    );

    await expect(
      useCase.controlRun({
        action: "retry",
        runId: pendingRun.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowActiveRunRetryError);
    expect(workflowRegistry.startCalls).toEqual([]);
  });

  it("branches a waiting workflow run from its persisted checkpoint", async () => {
    const sourceRun = createRun({
      id: "source-run",
      input: {
        articleId: "article-1",
      },
      status: "WAITING_FOR_APPROVAL",
      threadId: "source-thread",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(new RecordingAdminAgentRepository([sourceRun]), workflowRegistry);

    await useCase.controlRun({
      action: "branch",
      runId: sourceRun.id,
      startedByUserId: "admin-1",
    });

    expect(workflowRegistry.branchCalls).toEqual([
      {
        parentRunId: sourceRun.id,
        sourceThreadId: "source-thread",
        startedByUserId: "admin-1",
      },
    ]);
    expect(workflowRegistry.startCalls).toEqual([]);
  });

  it("does not branch workflow runs that are not paused for human input", async () => {
    const completedRun = createRun({
      id: "completed-run",
      status: "COMPLETED",
      threadId: "completed-thread",
    });
    const useCase = createUseCase(new RecordingAdminAgentRepository([completedRun]));

    await expect(
      useCase.controlRun({
        action: "branch",
        runId: completedRun.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowBranchUnavailableError);
  });

  it("requires a persisted thread before branching a paused workflow run", async () => {
    const pausedRunWithoutThread = createRun({
      id: "paused-run-without-thread",
      status: "WAITING_FOR_APPROVAL",
      threadId: null,
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([pausedRunWithoutThread]),
      workflowRegistry,
    );

    await expect(
      useCase.controlRun({
        action: "branch",
        runId: pausedRunWithoutThread.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowBranchUnavailableError);
    expect(workflowRegistry.branchCalls).toEqual([]);
  });

  it("does not refresh active or non multi-task workflow runs", async () => {
    const activeMultiTaskRun = createRun({
      id: "active-multi-task-run",
      status: "RUNNING",
      type: "MULTI_TASK_ORCHESTRATION",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
    const completedCommentRun = createRun({
      id: "completed-comment-run",
      status: "COMPLETED",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([activeMultiTaskRun, completedCommentRun]),
      workflowRegistry,
    );

    await expect(
      useCase.controlRun({
        action: "refresh",
        runId: activeMultiTaskRun.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowRefreshUnavailableError);
    await expect(
      useCase.controlRun({
        action: "refresh",
        runId: completedCommentRun.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowUnsupportedControlActionError);
    expect(workflowRegistry.refreshCalls).toEqual([]);
    expect(workflowRegistry.startCalls).toEqual([]);
    expect(workflowRegistry.branchCalls).toEqual([]);
  });

  it("resumes a waiting workflow run through its registered definition", async () => {
    const waitingRun = createRun({
      id: "waiting-run",
      status: "WAITING_FOR_APPROVAL",
      threadId: "thread-1",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry(
      createWorkflowResult({
        run: createRun({ id: waitingRun.id, status: "COMPLETED" }),
      }),
    );
    const recordAdminOperation = createRecordAdminOperation();
    const repairDecisionEffects = createRepairDecisionEffects();
    const repository = new RecordingAdminAgentRepository([waitingRun]);
    const useCase = createUseCase(
      repository,
      workflowRegistry,
      recordAdminOperation,
      repairDecisionEffects,
    );

    await useCase.resumeRun({
      actor: {
        id: "admin-1",
        login: "admin",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      resume: {
        decision: "APPROVE",
        findingIds: ["finding-1"],
      },
      runId: waitingRun.id,
    });

    expect(workflowRegistry.resumeCalls).toEqual([
      {
        actor: {
          id: "admin-1",
          login: "admin",
        },
        requestContext: {
          ipAddress: "127.0.0.1",
          userAgent: "vitest",
        },
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-1"],
        },
        threadId: "thread-1",
      },
    ]);
    expect(repairDecisionEffects.execute).toHaveBeenCalledWith({ runId: waitingRun.id });
    expect(recordAdminOperation.execute).toHaveBeenCalledWith({
      action: "ADMIN_AGENT_TASK_RESUMED",
      actor: {
        id: "admin-1",
        login: "admin",
      },
      metadata: {
        decision: "APPROVE",
        source: "admin_agent",
        status: "COMPLETED",
        taskTitle: "文章协作",
        taskName: "article_assistance",
      },
      requestContext: {
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
      resourceId: waitingRun.id,
      resourceType: "ADMIN_AGENT_TASK",
    });
    expect(repository.workflowEvents).toContainEqual(
      expect.objectContaining({
        payload: {
          action: "resume",
          resultRunId: waitingRun.id,
          resultStatus: "COMPLETED",
        },
        runId: waitingRun.id,
        summary: "文章协作已执行「继续执行」操作。",
        type: "CONTROLLED",
      }),
    );
  });

  it("keeps resume successful when decision-effect repair fails", async () => {
    const waitingRun = createRun({
      id: "waiting-run",
      status: "WAITING_FOR_APPROVAL",
      threadId: "thread-1",
    });
    const repairDecisionEffects = createRepairDecisionEffects();
    repairDecisionEffects.execute.mockRejectedValueOnce(new Error("repair unavailable"));
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry(
      createWorkflowResult({
        run: createRun({ id: waitingRun.id, status: "COMPLETED" }),
      }),
    );
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([waitingRun]),
      workflowRegistry,
      createRecordAdminOperation(),
      repairDecisionEffects,
    );

    await expect(
      useCase.resumeRun({
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-1"],
        },
        runId: waitingRun.id,
      }),
    ).resolves.toMatchObject({
      run: {
        status: "COMPLETED",
      },
    });

    expect(repairDecisionEffects.execute).toHaveBeenCalledWith({ runId: waitingRun.id });
  });

  it("rejects empty resume payloads before invoking a persisted workflow", async () => {
    const waitingRun = createRun({
      id: "waiting-run",
      status: "WAITING_FOR_APPROVAL",
      threadId: "thread-1",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([waitingRun]),
      workflowRegistry,
    );

    await expect(
      useCase.resumeRun({
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: {},
        runId: waitingRun.id,
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowInvalidResumeError);
    expect(workflowRegistry.resumeCalls).toEqual([]);
  });

  it("rejects non-record resume payloads before invoking a persisted workflow", async () => {
    const waitingRun = createRun({
      id: "waiting-run",
      status: "WAITING_FOR_APPROVAL",
      threadId: "thread-1",
    });
    const workflowRegistry = new RecordingAdminAgentWorkflowRegistry();
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([waitingRun]),
      workflowRegistry,
    );

    await expect(
      useCase.resumeRun({
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: [] as never,
        runId: waitingRun.id,
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowInvalidResumeError);
    expect(workflowRegistry.resumeCalls).toEqual([]);
  });

  it("rejects resume for runs that are not waiting for approval", async () => {
    const completedRun = createRun({
      id: "completed-run",
      status: "COMPLETED",
      threadId: "thread-1",
    });
    const useCase = createUseCase(new RecordingAdminAgentRepository([completedRun]));

    await expect(
      useCase.resumeRun({
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: {
          decision: "APPROVE",
          findingIds: [],
        },
        runId: completedRun.id,
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowResumeUnavailableError);
  });

  it("rejects retry and branch when the source workflow definition is not registered", async () => {
    const sourceRun = createRun({
      id: "comment-run",
      status: "COMPLETED",
    });
    const useCase = createUseCase(
      new RecordingAdminAgentRepository([sourceRun]),
      new RecordingAdminAgentWorkflowRegistry(createWorkflowResult(), []),
    );

    await expect(
      useCase.controlRun({
        action: "retry",
        runId: sourceRun.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowUnsupportedError);
    await expect(
      useCase.controlRun({
        action: "branch",
        runId: sourceRun.id,
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowUnsupportedError);
  });

  it("rejects control operations for missing runs", async () => {
    const useCase = createUseCase(new RecordingAdminAgentRepository());

    await expect(useCase.getRun("missing-run")).rejects.toBeInstanceOf(
      AdminAgentWorkflowNotFoundError,
    );
    await expect(
      useCase.controlRun({
        action: "branch",
        runId: "missing-run",
        startedByUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(AdminAgentWorkflowNotFoundError);
  });

  it("normalizes invalid list query values", () => {
    expect(
      normalizeListAdminAgentWorkflowRunsInput({
        page: -1,
        pageSize: 999,
        status: "UNKNOWN",
        workflowName: "UNKNOWN" as never,
      }),
    ).toEqual({
      page: 1,
      pageSize: 50,
      parentRunId: undefined,
      rootOnly: false,
      status: undefined,
      workflowName: undefined,
    });
  });

  it("normalizes workflow catalog names for run list filters", () => {
    expect(
      normalizeListAdminAgentWorkflowRunsInput({
        workflowName: "MULTI_TASK_ORCHESTRATION",
      }),
    ).toMatchObject({
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
  });
});

class RecordingAdminAgentRepository implements AdminAgentRepository {
  createdRuns: CreateAdminAgentRunInput[] = [];
  lastListFilters: ListAdminAgentRunsFilters | null = null;
  workflowEvents: Array<Parameters<AdminAgentRepository["createWorkflowEvent"]>[0]> = [];
  private readonly runs = new Map<string, AdminAgentRun>();

  constructor(runs: AdminAgentRun[] = []) {
    for (const run of runs) {
      this.runs.set(run.id, run);
    }
  }

  async createRun(input: CreateAdminAgentRunInput) {
    this.createdRuns.push(input);
    const run = createRun({
      dedupeKey: input.dedupeKey ?? null,
      id: input.id ?? `run-${this.createdRuns.length}`,
      input: input.input,
      parentRunId: input.parentRunId ?? null,
      parentRunRelation: input.parentRunRelation ?? null,
      startedByUserId: input.startedByUserId,
      threadId: input.threadId ?? null,
      type: input.type,
      workflowName: input.workflowName,
    });
    this.runs.set(run.id, run);
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

  async ensureWorkflowActionExecution(): Promise<
    Awaited<ReturnType<AdminAgentRepository["ensureWorkflowActionExecution"]>>
  > {
    throw new Error("not used");
  }

  async markWorkflowActionExecutionSucceeded(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markWorkflowActionExecutionSucceeded"]>>
  > {
    throw new Error("not used");
  }

  async markWorkflowActionExecutionFailed(): Promise<
    Awaited<ReturnType<AdminAgentRepository["markWorkflowActionExecutionFailed"]>>
  > {
    throw new Error("not used");
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

  async listRuns(filters: ListAdminAgentRunsFilters) {
    this.lastListFilters = filters;
    const data = [...this.runs.values()].filter(
      (run) =>
        (!filters.status || run.status === filters.status) &&
        (!filters.workflowName || run.workflowName === filters.workflowName) &&
        (!filters.parentRunId || run.parentRunId === filters.parentRunId) &&
        (!filters.parentRunRelation || run.parentRunRelation === filters.parentRunRelation) &&
        (!filters.rootOnly || run.parentRunId === null),
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

    if (run.status === "CANCELLED") {
      return run;
    }

    return this.updateRun(id, {
      lastResumedAt: options.resumed ? new Date("2026-07-04T10:05:00.000Z") : null,
      status: "RUNNING",
    });
  }

  async markRunNode() {}

  async markRunInterrupted(id: string, interruption: Record<string, unknown>, summary: string) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    return this.updateRun(id, { interruption, status: "WAITING_FOR_APPROVAL", summary });
  }

  async markRunWaitingForApproval(id: string, summary: string) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    return this.updateRun(id, { status: "WAITING_FOR_APPROVAL", summary });
  }

  async completeRun(id: string, summary: string) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    return this.updateRun(id, { status: "COMPLETED", summary });
  }

  async cancelRun(id: string, summary: string) {
    const run = this.updateRun(id, {
      currentNode: "cancelled",
      errorMessage: null,
      interruption: null,
      status: "CANCELLED",
      summary,
    });
    await this.createWorkflowEvent({
      node: "cancelled",
      runId: id,
      summary,
      type: "CANCELLED",
    });
    return run;
  }

  async failRun(id: string, errorMessage: string) {
    const run = this.requireRun(id);

    if (run.status === "CANCELLED") {
      return run;
    }

    return this.updateRun(id, { errorMessage, status: "FAILED" });
  }

  async findFindingById() {
    return null;
  }

  async markFindingExecuted(): Promise<AdminAgentFinding> {
    throw new Error("not used");
  }

  async markFindingFailed(): Promise<AdminAgentFinding> {
    throw new Error("not used");
  }

  async markFindingRejected(): Promise<AdminAgentFinding> {
    throw new Error("not used");
  }

  async markFindingRestored(): Promise<AdminAgentFinding> {
    throw new Error("not used");
  }

  async listTodayVisibleCommentsForAnalysis() {
    return [];
  }

  async listRecentVisibleCommentsForAnalysis() {
    return [];
  }

  async createFindings(_runId: string, _findings: AdminAgentFindingDraft[]) {
    return [];
  }

  async listPendingFindingsByTargetIds() {
    return [];
  }

  async listFindingsByIds() {
    return [];
  }

  async listFindingsByRunId() {
    return [];
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
}

class RecordingAdminAgentWorkflowRegistry implements AdminAgentWorkflowRegistry {
  branchCalls: Parameters<AdminAgentWorkflowDefinition["branch"]>[0][] = [];
  refreshCalls: Parameters<AdminAgentWorkflowDefinition["refresh"]>[0][] = [];
  resumeCalls: ResumeAdminAgentWorkflowInput[] = [];
  startCalls: StartAdminAgentWorkflowInput[] = [];
  startedWorkflowNames: AdminAgentWorkflowDefinition["workflowName"][] = [];
  private readonly definitions: AdminAgentWorkflowDefinition[];

  constructor(
    result = createWorkflowResult(),
    workflowNames: AdminAgentWorkflowDefinition["workflowName"][] = listAdminAgentWorkflowMetadata().map(
      (metadata) => metadata.workflowName,
    ),
  ) {
    this.definitions = workflowNames.map((workflowName) => {
      const metadata = listAdminAgentWorkflowMetadata().find(
        (item) => item.workflowName === workflowName,
      );

      if (!metadata) {
        throw new Error(`Unsupported test workflow ${workflowName}.`);
      }

      return {
        branch: async (input) => {
          this.branchCalls.push(input);
          return result;
        },
        resume: async (input) => {
          this.resumeCalls.push(input);
          return result;
        },
        refresh: async (input) => {
          this.refreshCalls.push(input);
          return result;
        },
        runType: metadata.runType,
        start: async (input) => {
          this.startedWorkflowNames.push(workflowName);
          this.startCalls.push(input);
          return result;
        },
        workflowName,
      };
    });
  }

  findByName(workflowName: AdminAgentRun["workflowName"]) {
    return this.definitions.find((definition) => definition.workflowName === workflowName) ?? null;
  }

  listDefinitions() {
    return [...this.definitions];
  }
}

function createUseCase(
  repository: AdminAgentRepository,
  workflowRegistry: AdminAgentWorkflowRegistry = new RecordingAdminAgentWorkflowRegistry(),
  recordAdminOperation: RecordAdminOperationUseCase = createRecordAdminOperation(),
  repairDecisionEffects: RepairAdminAgentDecisionEffectsUseCase = createRepairDecisionEffects(),
) {
  return new ManageAdminAgentWorkflowsUseCase(
    repository,
    workflowRegistry,
    recordAdminOperation,
    repairDecisionEffects,
  );
}

function createRecordAdminOperation() {
  return {
    execute: vi.fn().mockResolvedValue({
      action: "ADMIN_AGENT_TASK_STARTED",
      actorLogin: "admin",
      actorUserId: "admin-1",
      createdAt: new Date("2026-07-04T10:00:00.000Z"),
      id: "audit-1",
      ipAddress: null,
      metadata: null,
      resourceId: null,
      resourceType: "ADMIN_AGENT_TASK",
      summary: "启动 Agent 业务处理",
      userAgent: null,
    }),
  } as unknown as RecordAdminOperationUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createRepairDecisionEffects() {
  return {
    execute: vi.fn().mockResolvedValue({
      failedCount: 0,
      repairedCount: 0,
      skippedCount: 0,
    }),
  } as unknown as RepairAdminAgentDecisionEffectsUseCase & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createWorkflowResult(
  overrides: Partial<AdminAgentWorkflowResult> = {},
): AdminAgentWorkflowResult {
  return {
    interruption: null,
    output: {},
    run: createRun({ status: "COMPLETED" }),
    summary: "done",
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
    type: "ARTICLE_ASSISTANCE",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    workflowName: "ARTICLE_ASSISTANCE",
    ...overrides,
  };
}

function createWorkflowInputEnvelope(workflowInput: Record<string, unknown> | null) {
  return {
    requestedAt: "2026-07-04T10:00:00.000Z",
    startReason: "MANUAL",
    workflowInput,
  };
}

function getWorkflowInputFromEnvelope(input: Record<string, unknown>) {
  return input.workflowInput ?? null;
}
