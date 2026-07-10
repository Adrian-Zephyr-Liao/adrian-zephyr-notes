import { describe, expect, it } from "vitest";
import { RegisteredAdminAgentWorkflowRegistry } from "./admin-agent-workflow-registry";
import type {
  AdminAgentWorkflowResult,
  AdminAgentWorkflowRunner,
} from "../domain/admin-agent-workflow-runner";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import { listAdminAgentWorkflowMetadata } from "../domain/admin-agent-workflow-metadata";

describe("RegisteredAdminAgentWorkflowRegistry", () => {
  it("registers comment moderation as the first startable workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("COMMENT_MODERATION_ANALYSIS");

    expect(registry.listDefinitions()).toEqual([
      expect.objectContaining({
        runType: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
      expect.objectContaining({
        runType: "ARTICLE_ASSISTANCE",
        workflowName: "ARTICLE_ASSISTANCE",
      }),
      expect.objectContaining({
        runType: "SITE_CONFIG_REVIEW",
        workflowName: "SITE_CONFIG_REVIEW",
      }),
      expect.objectContaining({
        runType: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      }),
      expect.objectContaining({
        runType: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      }),
    ]);
    expect(definition).toEqual(
      expect.objectContaining({
        runType: "COMMENT_MODERATION_TODAY",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      }),
    );

    await definition?.start({
      input: {
        scope: "today",
      },
      parentRunId: "parent-run",
      startedByUserId: "admin-1",
      startReason: "MANUAL",
    });

    expect(runner.startCalls).toEqual([
      {
        input: {
          scope: "today",
        },
        parentRunId: "parent-run",
        startedByUserId: "admin-1",
        startReason: "MANUAL",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
    ]);
  });

  it("does not register unknown workflow definitions", () => {
    const registry = new RegisteredAdminAgentWorkflowRegistry(
      new RecordingAdminAgentWorkflowRunner(),
    );

    expect(registry.findByName("UNKNOWN" as never)).toBeNull();
  });

  it("registers article assistance as a startable read-only workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("ARTICLE_ASSISTANCE");

    expect(definition).toEqual(
      expect.objectContaining({
        runType: "ARTICLE_ASSISTANCE",
        workflowName: "ARTICLE_ASSISTANCE",
      }),
    );

    await definition?.start({
      input: {
        status: "DRAFT",
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "MANUAL",
    });

    expect(runner.startCalls).toContainEqual({
      input: {
        status: "DRAFT",
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "MANUAL",
      workflowName: "ARTICLE_ASSISTANCE",
    });
  });

  it("registers audit review as a startable read-only workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("AUDIT_REVIEW");

    expect(definition).toEqual(
      expect.objectContaining({
        runType: "AUDIT_REVIEW",
        workflowName: "AUDIT_REVIEW",
      }),
    );

    await definition?.start({
      input: {
        actorLogin: "adrian",
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "MANUAL",
    });

    expect(runner.startCalls).toContainEqual({
      input: {
        actorLogin: "adrian",
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "MANUAL",
      workflowName: "AUDIT_REVIEW",
    });
  });

  it("registers site config review as a startable read-only workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("SITE_CONFIG_REVIEW");

    expect(definition).toEqual(
      expect.objectContaining({
        runType: "SITE_CONFIG_REVIEW",
        workflowName: "SITE_CONFIG_REVIEW",
      }),
    );

    await definition?.start({
      input: {
        includeDisabledAnnouncements: true,
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "MANUAL",
    });

    expect(runner.startCalls).toContainEqual({
      input: {
        includeDisabledAnnouncements: true,
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "MANUAL",
      workflowName: "SITE_CONFIG_REVIEW",
    });
  });

  it("registers multi-task orchestration as a startable parent workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("MULTI_TASK_ORCHESTRATION");

    expect(definition).toEqual(
      expect.objectContaining({
        runType: "MULTI_TASK_ORCHESTRATION",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      }),
    );

    await definition?.start({
      input: {
        goal: "检查评论和审计日志",
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "CHAT_INTENT",
    });

    expect(runner.startCalls).toContainEqual({
      input: {
        goal: "检查评论和审计日志",
      },
      parentRunId: null,
      startedByUserId: "admin-1",
      startReason: "CHAT_INTENT",
      workflowName: "MULTI_TASK_ORCHESTRATION",
    });
  });

  it("keeps registered workflow definitions aligned with the shared startable catalog", () => {
    const registry = new RegisteredAdminAgentWorkflowRegistry(
      new RecordingAdminAgentWorkflowRunner(),
    );
    const startableAdminAgentWorkflowNames = listStartableAdminAgentWorkflowNames();

    expect(registry.listDefinitions().map((definition) => definition.workflowName)).toEqual(
      startableAdminAgentWorkflowNames,
    );
  });

  it("routes start, resume and branch for every registered workflow through the runner", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);
    const startableAdminAgentWorkflowNames = listStartableAdminAgentWorkflowNames();

    for (const workflowName of startableAdminAgentWorkflowNames) {
      const definition = registry.findByName(workflowName);

      await definition?.start({
        input: {
          task: workflowName,
        },
        parentRunId: null,
        startedByUserId: "admin-1",
        startReason: "CHAT_INTENT",
      });
      await definition?.resume({
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: {
          decision: "APPROVE",
        },
        threadId: `${workflowName}:thread`,
      });
      await definition?.branch({
        parentRunId: `${workflowName}:parent`,
        sourceThreadId: `${workflowName}:source-thread`,
        startedByUserId: "admin-1",
      });
    }

    expect(runner.startCalls.map((call) => call.workflowName)).toEqual(
      startableAdminAgentWorkflowNames,
    );
    expect(runner.resumeCalls.map((call) => call.workflowName)).toEqual(
      startableAdminAgentWorkflowNames,
    );
    expect(runner.branchCalls.map((call) => call.workflowName)).toEqual(
      startableAdminAgentWorkflowNames,
    );
  });

  it("registers comment moderation resume through the workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("COMMENT_MODERATION_ANALYSIS");

    await definition?.resume({
      actor: {
        id: "admin-1",
        login: "admin",
      },
      resume: {
        decision: "APPROVE",
        findingIds: ["finding-1"],
      },
      threadId: "thread-1",
    });

    expect(runner.resumeCalls).toEqual([
      {
        actor: {
          id: "admin-1",
          login: "admin",
        },
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-1"],
        },
        threadId: "thread-1",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
    ]);
  });

  it("registers comment moderation branch through the workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("COMMENT_MODERATION_ANALYSIS");

    await definition?.branch({
      parentRunId: "parent-run",
      sourceThreadId: "source-thread",
      startedByUserId: "admin-1",
    });

    expect(runner.branchCalls).toEqual([
      {
        parentRunId: "parent-run",
        sourceThreadId: "source-thread",
        startedByUserId: "admin-1",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
    ]);
  });

  it("registers multi-task refresh through the workflow definition", async () => {
    const runner = new RecordingAdminAgentWorkflowRunner();
    const registry = new RegisteredAdminAgentWorkflowRegistry(runner);

    const definition = registry.findByName("MULTI_TASK_ORCHESTRATION");

    await definition?.refresh({
      runId: "parent-run",
      startedByUserId: "admin-1",
    });

    expect(runner.refreshCalls).toEqual([
      {
        runId: "parent-run",
        startedByUserId: "admin-1",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
    ]);
  });
});

function listStartableAdminAgentWorkflowNames() {
  return listAdminAgentWorkflowMetadata()
    .filter((metadata) => metadata.supportsStart)
    .map((metadata) => metadata.workflowName);
}

class RecordingAdminAgentWorkflowRunner implements AdminAgentWorkflowRunner {
  branchCalls: Array<Parameters<AdminAgentWorkflowRunner["branchWorkflow"]>[0]> = [];
  refreshCalls: Array<Parameters<AdminAgentWorkflowRunner["refreshWorkflow"]>[0]> = [];
  resumeCalls: Array<Parameters<AdminAgentWorkflowRunner["resumeWorkflow"]>[0]> = [];
  startCalls: Array<Parameters<AdminAgentWorkflowRunner["startWorkflow"]>[0]> = [];

  async branchWorkflow(input: Parameters<AdminAgentWorkflowRunner["branchWorkflow"]>[0]) {
    this.branchCalls.push(input);
    return createWorkflowResult();
  }

  async startWorkflow(input: Parameters<AdminAgentWorkflowRunner["startWorkflow"]>[0]) {
    this.startCalls.push(input);
    return createWorkflowResult();
  }

  async refreshWorkflow(input: Parameters<AdminAgentWorkflowRunner["refreshWorkflow"]>[0]) {
    this.refreshCalls.push(input);
    return createWorkflowResult();
  }

  async resumeWorkflow(input: Parameters<AdminAgentWorkflowRunner["resumeWorkflow"]>[0]) {
    this.resumeCalls.push(input);
    return createWorkflowResult();
  }
}

function createWorkflowResult(
  overrides: Partial<AdminAgentWorkflowResult> = {},
): AdminAgentWorkflowResult {
  return {
    interruption: null,
    output: overrides.output ?? {
      findingCount: 0,
      scope: "today",
      workflow: "comment_moderation",
    },
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
    type: "COMMENT_MODERATION_TODAY",
    updatedAt: new Date("2026-07-04T10:00:00.000Z"),
    workflowName: "COMMENT_MODERATION_ANALYSIS",
    ...overrides,
  };
}
