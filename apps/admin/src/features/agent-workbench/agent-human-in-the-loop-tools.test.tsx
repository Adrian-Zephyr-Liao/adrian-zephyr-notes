// @vitest-environment jsdom

import type {
  AdminAgentHomeResponse,
  AdminAgentTaskSummaryResponse,
} from "@adrian-zephyr-notes/contracts";
import { adminAgentTaskCatalog } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentHumanInLoopTools } from "./agent-human-in-the-loop-tools";

const adminApiMocks = vi.hoisted(() => ({
  controlAdminAgentTask: vi.fn(),
  resumeAdminAgentTask: vi.fn(),
  startAdminAgentTask: vi.fn(),
}));

const copilotKitMocks = vi.hoisted(() => ({
  registeredTools: [] as HumanInTheLoopToolConfig[],
  useHumanInTheLoop: vi.fn((config: HumanInTheLoopToolConfig) => {
    copilotKitMocks.registeredTools.push(config);
  }),
}));

vi.mock("@copilotkit/react-core/v2", () => ({
  useHumanInTheLoop: copilotKitMocks.useHumanInTheLoop,
}));

vi.mock("../../lib/admin-api", () => ({
  controlAdminAgentTask: adminApiMocks.controlAdminAgentTask,
  resumeAdminAgentTask: adminApiMocks.resumeAdminAgentTask,
  startAdminAgentTask: adminApiMocks.startAdminAgentTask,
}));

describe("AgentHumanInLoopTools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    copilotKitMocks.registeredTools = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("registers tools with business-facing descriptions only", () => {
    renderAgentTools({ onOperationApplied: vi.fn() });

    const registeredDescriptions = copilotKitMocks.registeredTools
      .map((tool) => tool.description)
      .join("\n");

    expect(registeredDescriptions).toContain("Agent business action");
    expect(registeredDescriptions).toContain("workspace.businessTaskContext");
    expect(registeredDescriptions).not.toContain("workspace.collaborationContext");
    expect(registeredDescriptions).not.toMatch(
      /LangGraph|checkpoint|thread_id|threadId|workflowName|persisted flow|collaboration flow/,
    );
  });

  it("registers a conversation tool that starts the backend Agent comment task", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.startAdminAgentTask.mockResolvedValue({
      interruption: {
        action: "HIDE_COMMENT",
        approvalId: "comment-moderation:run-1",
        findingIds: ["finding-1"],
        kind: "COMMENT_MODERATION_APPROVAL",
        options: [
          {
            description: "批量执行 Agent 生成的屏蔽建议。",
            id: "server_confirm_hide",
            label: "确认屏蔽",
            resume: {
              decision: "APPROVE",
              findingIds: ["finding-1"],
            },
          },
          {
            description: "保留建议但暂不执行写操作。",
            id: "defer",
            label: "暂不处理",
            resume: {
              decision: "DEFER",
              findingIds: ["finding-1"],
            },
          },
        ],
        payload: {
          findingIds: ["finding-1"],
          scope: "today",
        },
        question: "是否确认屏蔽 1 条评论？",
        scope: "today",
        subject: "ARTICLE_COMMENT",
        summary: "确认后将屏蔽 1 条评论。",
      },
      output: {
        findingCount: 1,
        scope: "today",
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-1",
        parentTaskId: null,
        status: "WAITING_FOR_APPROVAL",
        summary: "发现 1 条需要确认的评论。",
        updatedAt: "2026-07-04T05:00:01.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "发现 1 条需要确认的评论。",
    });
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
        summary: "已屏蔽 1 条评论。",
        updatedAt: "2026-07-04T05:00:02.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "已屏蔽 1 条评论。",
    });

    renderAgentTools({ onOperationApplied });
    expect(copilotKitMocks.registeredTools.map((toolConfig) => toolConfig.name)).not.toContain(
      "request_comment_moderation_confirmation",
    );

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "start_admin_agent_task",
    );

    expect(tool).toBeDefined();

    const respond = vi.fn().mockResolvedValue(undefined);

    render(<StartTaskToolHarness respond={respond} tool={tool as HumanInTheLoopToolConfig} />);

    await waitFor(() => {
      expect(adminApiMocks.startAdminAgentTask).toHaveBeenCalledWith({
        input: {
          requestedReason: "分析今日评论",
          scope: "today",
        },
        taskName: "comment_moderation_analysis",
      });
    });

    expect(await screen.findByText("评论治理正在协作")).not.toBeNull();
    expect(screen.getByText("发现 1 条需要确认的评论。")).not.toBeNull();
    expect(screen.getByText("需要确认")).not.toBeNull();
    expect(screen.getByText("是否确认屏蔽 1 条评论？")).not.toBeNull();
    expect(screen.queryByText("run run-1")).toBeNull();
    expect(screen.queryByText("WAITING_FOR_APPROVAL")).toBeNull();
    expect(onOperationApplied).toHaveBeenCalledTimes(1);
    expect(respond).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "确认屏蔽批量执行 Agent 生成的屏蔽建议。" }),
    );

    await waitFor(() => {
      expect(adminApiMocks.resumeAdminAgentTask).toHaveBeenCalledWith("run-1", {
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-1"],
        },
      });
    });

    expect(await screen.findByText("操作已执行")).not.toBeNull();
    expect(screen.getByText("已执行 1 条。")).not.toBeNull();
    expect(screen.getByText("执行回执")).not.toBeNull();
    expect(screen.getByText("第 1 项 · 屏蔽")).not.toBeNull();
    expect(screen.queryByText("finding-1")).toBeNull();
    expect(screen.getByText("评论已屏蔽。")).not.toBeNull();
    expect(onOperationApplied).toHaveBeenCalledTimes(2);
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedCount: 1,
        failedCount: 0,
        message: "已执行 1 条。",
        selectedChoiceLabel: "确认屏蔽",
        status: "completed",
        taskName: "comment_moderation_analysis",
      }),
    );
    expect(JSON.stringify(respond.mock.calls[0]?.[0])).not.toMatch(
      /agent_task_resume|operations|run-1|finding-1/,
    );
  });

  it("keeps backend orchestration events out of the conversation tool card", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.startAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {
        findingCount: 0,
        scope: "today",
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-events",
        parentTaskId: null,
        status: "COMPLETED",
        summary: "评论治理已完成。",
        updatedAt: "2026-07-04T05:00:01.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "评论治理已完成。",
    });
    renderAgentTools({ onOperationApplied });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "start_admin_agent_task",
    );
    const respond = vi.fn().mockResolvedValue(undefined);

    render(<StartTaskToolHarness respond={respond} tool={tool as HumanInTheLoopToolConfig} />);

    expect(await screen.findByText("评论治理正在协作")).not.toBeNull();
    expect(screen.getByText("评论治理已完成。")).not.toBeNull();
    expect(screen.queryByText("处理进度")).toBeNull();
    expect(screen.queryByText("创建任务")).toBeNull();
    expect(screen.queryByText("处理步骤")).toBeNull();
    expect(screen.queryByText("子任务")).toBeNull();
    expect(screen.queryByText("站点巡检")).toBeNull();
    expect(document.body.textContent).not.toMatch(
      /LangGraph|checkpoint|thread_id|threadId|workflowName|node|payload/,
    );
  });

  it("sanitizes internal runtime copy from approval cards", async () => {
    adminApiMocks.startAdminAgentTask.mockResolvedValue({
      interruption: {
        action: "HIDE_COMMENT",
        approvalId: "comment-moderation:run-1",
        findingIds: ["finding-1"],
        kind: "COMMENT_MODERATION_APPROVAL",
        options: [
          {
            description: "屏蔽这条评论。\nthreadId checkpoint node",
            id: "server_confirm_hide",
            label: "确认屏蔽",
            resume: {
              decision: "APPROVE",
              findingIds: ["finding-1"],
            },
          },
          {
            description: "LangGraph checkpoint workflowName agent/runs",
            id: "defer",
            label: "暂不处理",
            resume: {
              decision: "DEFER",
              findingIds: ["finding-1"],
            },
          },
        ],
        payload: {
          findingIds: ["finding-1"],
          scope: "today",
        },
        question: "是否确认屏蔽 1 条评论？\nLangGraph checkpoint threadId",
        scope: "today",
        subject: "ARTICLE_COMMENT",
        summary: "Opened /agent/runs/thread-1 LangGraph 运行面板 for checkpoint threadId.",
      },
      output: {
        findingCount: 1,
        scope: "today",
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-1",
        parentTaskId: null,
        status: "WAITING_FOR_APPROVAL",
        summary: "发现 1 条需要确认的评论。",
        taskName: "comment_moderation_analysis",
        updatedAt: "2026-07-04T05:00:01.000Z",
      },
      summary: "发现 1 条需要确认的评论。",
    });

    renderAgentTools({ onOperationApplied: vi.fn().mockResolvedValue(undefined) });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "start_admin_agent_task",
    );

    render(
      <StartTaskToolHarness
        respond={vi.fn().mockResolvedValue(undefined)}
        tool={tool as HumanInTheLoopToolConfig}
      />,
    );

    expect(await screen.findByText("是否确认屏蔽 1 条评论？")).not.toBeNull();
    expect(screen.getAllByText("业务处理需要管理员确认。").length).toBeGreaterThan(0);
    expect(screen.getByText("屏蔽这条评论。")).not.toBeNull();
    expect(document.body.textContent).not.toMatch(
      /LangGraph|checkpoint|threadId|workflowName|node|agent\/runs|运行面板|运行态|运行时/,
    );
  });

  it("does not start unavailable registered Agent tasks", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);
    const home = createHomeResponse({
      tasks: createHomeResponse().tasks.map((task) =>
        task.taskName === "comment_moderation_analysis"
          ? {
              ...task,
              availability: "PLANNED",
            }
          : task,
      ),
    });

    renderAgentTools({ home, onOperationApplied });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "start_admin_agent_task",
    );
    const respond = vi.fn().mockResolvedValue(undefined);

    render(<StartTaskToolHarness respond={respond} tool={tool as HumanInTheLoopToolConfig} />);

    expect(
      await screen.findByText("缺少可启动的 Agent 业务处理名称，请从当前业务处理目录中选择。"),
    ).not.toBeNull();
    expect(adminApiMocks.startAdminAgentTask).not.toHaveBeenCalled();
    expect(onOperationApplied).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });

  it("does not mark a successful resume with skipped writes as incomplete", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.startAdminAgentTask.mockResolvedValue({
      interruption: {
        action: "HIDE_COMMENT",
        approvalId: "comment-moderation:run-skipped",
        findingIds: ["finding-skipped"],
        kind: "COMMENT_MODERATION_APPROVAL",
        options: [
          {
            description: "确认后继续 Agent 任务，但当前没有可执行写操作。",
            id: "confirm_skipped",
            label: "确认继续",
            resume: {
              decision: "APPROVE",
              findingIds: ["finding-skipped"],
            },
          },
        ],
        payload: {
          findingIds: ["finding-skipped"],
          scope: "today",
        },
        question: "是否确认继续处理？",
        scope: "today",
        subject: "ARTICLE_COMMENT",
        summary: "当前建议需要确认。",
      },
      output: {
        findingCount: 1,
        scope: "today",
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-skipped",
        parentTaskId: null,
        status: "WAITING_FOR_APPROVAL",
        summary: "当前建议需要确认。",
        updatedAt: "2026-07-04T05:00:01.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "当前建议需要确认。",
    });
    adminApiMocks.resumeAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {
        actionResult: {
          appliedCount: 0,
          failedCount: 0,
          results: [],
        },
        findingCount: 1,
        scope: "today",
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-skipped",
        parentTaskId: null,
        status: "COMPLETED",
        summary: "Agent 已继续处理。",
        updatedAt: "2026-07-04T05:00:02.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "Agent 已继续处理。",
    });

    renderAgentTools({ onOperationApplied });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "start_admin_agent_task",
    );
    const respond = vi.fn().mockResolvedValue(undefined);

    render(<StartTaskToolHarness respond={respond} tool={tool as HumanInTheLoopToolConfig} />);

    expect(await screen.findByText("是否确认继续处理？")).not.toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "确认继续确认后继续 Agent 任务，但当前没有可执行写操作。",
      }),
    );

    await waitFor(() => {
      expect(adminApiMocks.resumeAdminAgentTask).toHaveBeenCalledWith("run-skipped", {
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-skipped"],
        },
      });
    });

    expect(await screen.findByText("已提交选择")).not.toBeNull();
    expect(screen.getByText("跳过 1 条。")).not.toBeNull();
    expect(screen.queryByText("操作未完成")).toBeNull();
    expect(screen.queryByText("已执行 0 条，跳过 1 条。")).toBeNull();
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedCount: 0,
        failedCount: 0,
        message: "跳过 1 条。",
        partialFailure: true,
        selectedChoiceLabel: "确认继续",
        status: "completed",
      }),
    );
  });

  it("registers a conversation tool that branches an existing backend Agent task", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.controlAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {
        findingCount: 0,
        scope: "today",
      },
      task: {
        createdAt: "2026-07-04T05:10:00.000Z",
        errorMessage: null,
        id: "run-branch",
        parentTaskId: "run-source",
        status: "COMPLETED",
        summary: "另开处理任务已完成。",
        updatedAt: "2026-07-04T05:10:01.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "另开处理任务已完成。",
    });

    renderAgentTools({
      agentTasks: [
        createTask({
          id: "run-source",
          status: "WAITING_FOR_APPROVAL",
        }),
      ],
      onOperationApplied,
    });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "control_admin_agent_task",
    );

    expect(tool).toBeDefined();

    const respond = vi.fn().mockResolvedValue(undefined);

    render(
      <ControlTaskToolHarness
        args={{
          action: "branch",
          reason: "重新基于历史判断分支",
          taskId: "run-source",
        }}
        respond={respond}
        tool={tool as HumanInTheLoopToolConfig}
      />,
    );

    await waitFor(() => {
      expect(adminApiMocks.controlAdminAgentTask).toHaveBeenCalledWith("run-source", {
        action: "branch",
      });
    });

    expect(await screen.findByText("另开处理已提交")).not.toBeNull();
    expect(screen.getByText("另开处理任务已完成。")).not.toBeNull();
    expect(document.body.textContent).not.toContain("分支协作");
    expect(screen.queryByText("run run-branch")).toBeNull();
    expect(screen.queryByText("COMPLETED")).toBeNull();
    expect(onOperationApplied).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "另开处理任务已完成。",
        status: "completed",
      }),
    );
    expect(JSON.stringify(respond.mock.calls[0]?.[0])).not.toMatch(/run-branch|run-source/);
  });

  it("registers a conversation tool that cancels an active backend Agent task", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.controlAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {},
      task: {
        createdAt: "2026-07-04T05:10:00.000Z",
        errorMessage: null,
        id: "run-source",
        parentTaskId: null,
        status: "CANCELLED",
        summary: "Agent 业务处理已取消。",
        taskName: "comment_moderation_analysis",
        updatedAt: "2026-07-04T05:10:01.000Z",
      },
      summary: "Agent 业务处理已取消。",
    });

    renderAgentTools({
      agentTasks: [
        createTask({
          id: "run-source",
          status: "RUNNING",
        }),
      ],
      onOperationApplied,
    });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "control_admin_agent_task",
    );
    const respond = vi.fn().mockResolvedValue(undefined);

    render(
      <ControlTaskToolHarness
        args={{
          action: "cancel",
          reason: "管理员要求停止当前业务处理",
          taskId: "run-source",
        }}
        respond={respond}
        tool={tool as HumanInTheLoopToolConfig}
      />,
    );

    await waitFor(() => {
      expect(adminApiMocks.controlAdminAgentTask).toHaveBeenCalledWith("run-source", {
        action: "cancel",
      });
    });

    expect(await screen.findByText("取消已提交")).not.toBeNull();
    expect(screen.getByText("Agent 业务处理已取消。")).not.toBeNull();
    expect(onOperationApplied).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Agent 业务处理已取消。",
        status: "completed",
      }),
    );
    expect(JSON.stringify(respond.mock.calls[0]?.[0])).not.toMatch(/run-source|CANCELLED/);
  });

  it("controls the latest retry attempt when the model passes the source task id", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.controlAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {},
      task: {
        createdAt: "2026-07-04T05:12:00.000Z",
        errorMessage: null,
        id: "run-retry-latest",
        parentTaskId: "run-source",
        relation: "retry",
        status: "CANCELLED",
        summary: "最新重试已取消。",
        taskName: "comment_moderation_analysis",
        updatedAt: "2026-07-04T05:13:00.000Z",
      },
      summary: "最新重试已取消。",
    });

    renderAgentTools({
      agentTasks: [
        createTask({
          id: "run-source",
          status: "FAILED",
          updatedAt: "2026-07-04T05:10:00.000Z",
        }),
        createTask({
          id: "run-retry-old",
          parentTaskId: "run-source",
          relation: "retry",
          status: "RUNNING",
          updatedAt: "2026-07-04T05:11:00.000Z",
        }),
        createTask({
          id: "run-retry-latest",
          parentTaskId: "run-source",
          relation: "retry",
          status: "RUNNING",
          updatedAt: "2026-07-04T05:12:00.000Z",
        }),
      ],
      onOperationApplied,
    });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "control_admin_agent_task",
    );
    const respond = vi.fn().mockResolvedValue(undefined);

    render(
      <ControlTaskToolHarness
        args={{
          action: "cancel",
          reason: "停止最新重试",
          taskId: "run-source",
        }}
        respond={respond}
        tool={tool as HumanInTheLoopToolConfig}
      />,
    );

    await waitFor(() => {
      expect(adminApiMocks.controlAdminAgentTask).toHaveBeenCalledWith("run-retry-latest", {
        action: "cancel",
      });
    });

    expect(await screen.findByText("取消已提交")).not.toBeNull();
    expect(screen.getByText("最新重试已取消。")).not.toBeNull();
    expect(onOperationApplied).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "最新重试已取消。",
        status: "completed",
      }),
    );
    expect(JSON.stringify(respond.mock.calls[0]?.[0])).not.toMatch(
      /run-source|run-retry-latest|run-retry-old/,
    );
  });

  it("waits for admin approval when a branched Agent task pauses again", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.controlAdminAgentTask.mockResolvedValue({
      interruption: {
        action: "HIDE_COMMENT",
        approvalId: "comment-moderation:run-branch",
        findingIds: ["finding-branch"],
        kind: "COMMENT_MODERATION_APPROVAL",
        options: [
          {
            description: "执行另开处理产生的新屏蔽建议。",
            id: "branch_confirm_hide",
            label: "确认屏蔽",
            resume: {
              decision: "APPROVE",
              findingIds: ["finding-branch"],
            },
          },
          {
            description: "保留另开处理结果但不执行写操作。",
            id: "branch_defer",
            label: "暂不处理",
            resume: {
              decision: "DEFER",
              findingIds: ["finding-branch"],
            },
          },
        ],
        payload: {
          findingIds: ["finding-branch"],
          scope: "recentVisibleFallback",
        },
        question: "是否确认屏蔽另开处理发现的 1 条评论？",
        scope: "recentVisibleFallback",
        subject: "ARTICLE_COMMENT",
        summary: "确认后将屏蔽 1 条评论。",
      },
      output: {
        findingCount: 1,
        scope: "recentVisibleFallback",
      },
      task: {
        createdAt: "2026-07-04T05:10:00.000Z",
        errorMessage: null,
        id: "run-branch",
        parentTaskId: "run-source",
        status: "WAITING_FOR_APPROVAL",
        summary: "另开处理发现 1 条需要确认的评论。",
        updatedAt: "2026-07-04T05:10:01.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "另开处理发现 1 条需要确认的评论。",
    });
    adminApiMocks.resumeAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {
        actionResult: {
          appliedCount: 1,
          failedCount: 0,
          results: [
            {
              resourceId: "finding-branch",
              status: "APPLIED",
              summary: "另开处理评论已屏蔽。",
            },
          ],
        },
        findingCount: 1,
        scope: "recentVisibleFallback",
      },
      task: {
        createdAt: "2026-07-04T05:10:00.000Z",
        errorMessage: null,
        id: "run-branch",
        parentTaskId: "run-source",
        status: "COMPLETED",
        summary: "另开处理评论已屏蔽。",
        updatedAt: "2026-07-04T05:10:02.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "另开处理评论已屏蔽。",
    });

    renderAgentTools({
      agentTasks: [
        createTask({
          id: "run-source",
          status: "WAITING_FOR_APPROVAL",
        }),
      ],
      onOperationApplied,
    });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "control_admin_agent_task",
    );
    const respond = vi.fn().mockResolvedValue(undefined);

    render(
      <ControlTaskToolHarness
        args={{
          action: "branch",
          reason: "换一种处理路径",
          taskId: "run-source",
        }}
        respond={respond}
        tool={tool as HumanInTheLoopToolConfig}
      />,
    );

    await waitFor(() => {
      expect(adminApiMocks.controlAdminAgentTask).toHaveBeenCalledWith("run-source", {
        action: "branch",
      });
    });

    expect(await screen.findByText("另开处理已提交")).not.toBeNull();
    expect(screen.getByText("另开处理发现 1 条需要确认的评论。")).not.toBeNull();
    expect(screen.getByText("是否确认屏蔽另开处理发现的 1 条评论？")).not.toBeNull();
    expect(screen.getByText("需要确认")).not.toBeNull();
    expect(respond).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认屏蔽执行另开处理产生的新屏蔽建议。" }));

    await waitFor(() => {
      expect(adminApiMocks.resumeAdminAgentTask).toHaveBeenCalledWith("run-branch", {
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-branch"],
        },
      });
    });

    expect(await screen.findByText("操作已执行")).not.toBeNull();
    expect(screen.getByText("另开处理评论已屏蔽。")).not.toBeNull();
    expect(document.body.textContent).not.toContain("分支协作");
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedCount: 1,
        failedCount: 0,
        message: "已执行 1 条。",
        selectedChoiceLabel: "确认屏蔽",
        status: "completed",
      }),
    );
    expect(JSON.stringify(respond.mock.calls[0]?.[0])).not.toMatch(
      /agent_task_resume|operations|run-branch|finding-branch/,
    );
  });

  it("does not execute unavailable Agent task controls", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);
    const home = createHomeResponse({
      tasks: createHomeResponse().tasks.map((task) =>
        task.taskName === "comment_moderation_analysis"
          ? {
              ...task,
              controls: task.controls.map((control) =>
                control.action === "branch"
                  ? {
                      ...control,
                      availability: "PLANNED",
                    }
                  : control,
              ),
            }
          : task,
      ),
    });

    renderAgentTools({
      agentTasks: [
        createTask({
          id: "run-source",
          status: "WAITING_FOR_APPROVAL",
        }),
      ],
      home,
      onOperationApplied,
    });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "control_admin_agent_task",
    );
    const respond = vi.fn().mockResolvedValue(undefined);

    render(
      <ControlTaskToolHarness
        args={{
          action: "branch",
          reason: "重新基于历史判断分支",
          taskId: "run-source",
        }}
        respond={respond}
        tool={tool as HumanInTheLoopToolConfig}
      />,
    );

    expect(await screen.findByText("缺少可执行的 Agent 业务处理参数。")).not.toBeNull();
    expect(adminApiMocks.controlAdminAgentTask).not.toHaveBeenCalled();
    expect(onOperationApplied).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
      }),
    );
  });

  it("answers AskUserQuestion choices by resuming the backend Agent task once", async () => {
    const onOperationApplied = vi.fn().mockResolvedValue(undefined);

    adminApiMocks.resumeAdminAgentTask.mockResolvedValue({
      interruption: null,
      output: {
        actionResult: {
          appliedCount: 2,
          failedCount: 1,
          results: [
            {
              resourceId: "finding-1",
              status: "APPLIED",
              summary: "第一条评论已屏蔽。",
            },
            {
              resourceId: "finding-2",
              status: "APPLIED",
            },
            {
              error: {
                code: "COMMENT_NOT_FOUND",
                message: "第三条评论不存在。",
              },
              resourceId: "finding-3",
              status: "FAILED",
            },
          ],
        },
        findingCount: 3,
        scope: "recent",
      },
      task: {
        createdAt: "2026-07-04T05:00:00.000Z",
        errorMessage: null,
        id: "run-approval",
        parentTaskId: null,
        status: "COMPLETED",
        summary: "已处理 3 条评论。",
        updatedAt: "2026-07-04T05:00:02.000Z",
        taskName: "comment_moderation_analysis",
      },
      summary: "已处理 3 条评论。",
    });

    renderAgentTools({ onOperationApplied });

    const tool = copilotKitMocks.registeredTools.find(
      (registeredTool) => registeredTool.name === "ask_user_question",
    );

    expect(tool).toBeDefined();

    const respond = vi.fn().mockResolvedValue(undefined);

    render(<AskQuestionToolHarness respond={respond} tool={tool as HumanInTheLoopToolConfig} />);

    fireEvent.click(screen.getByRole("button", { name: "确认屏蔽批量屏蔽 3 条评论。" }));

    await waitFor(() => {
      expect(adminApiMocks.resumeAdminAgentTask).toHaveBeenCalledWith("run-approval", {
        resume: {
          decision: "APPROVE",
          findingIds: ["finding-1", "finding-2", "finding-3"],
        },
      });
    });

    expect(onOperationApplied).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("操作已执行")).not.toBeNull();
    expect(screen.getByText("已执行 2 条，失败 1 条。")).not.toBeNull();
    expect(screen.getByText("执行回执")).not.toBeNull();
    expect(screen.getByText("第 3 项 · 屏蔽")).not.toBeNull();
    expect(screen.queryByText("finding-3")).toBeNull();
    expect(screen.getByText("第三条评论不存在。")).not.toBeNull();
    expect(respond).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedCount: 2,
        failedCount: 1,
        message: "已执行 2 条，失败 1 条。",
        partialFailure: true,
        selectedChoiceLabel: "确认屏蔽",
        status: "completed",
      }),
    );
    expect(JSON.stringify(respond.mock.calls[0]?.[0])).not.toMatch(
      /agent_task_resume|operations|run-approval|finding-1/,
    );
  });
});

function StartTaskToolHarness({
  respond,
  tool,
}: {
  respond: (result: unknown) => Promise<void>;
  tool: HumanInTheLoopToolConfig;
}) {
  return (
    <>
      {tool.render({
        args: {
          input: {
            scope: "today",
          },
          reason: "分析今日评论",
          taskName: "comment_moderation_analysis",
        },
        description: "Start comment moderation task",
        name: tool.name,
        respond,
        result: undefined,
        status: "executing",
        toolCallId: "tool-call-start-task",
      })}
    </>
  );
}

function renderAgentTools({
  agentTasks = [],
  home = createHomeResponse(),
  onOperationApplied,
}: {
  agentTasks?: AdminAgentTaskSummaryResponse[];
  home?: AdminAgentHomeResponse;
  onOperationApplied: () => Promise<void> | void;
}) {
  return render(
    <AgentHumanInLoopTools
      agentTasks={agentTasks}
      home={home}
      onOperationApplied={async () => {
        await onOperationApplied();
      }}
    />,
  );
}

function ControlTaskToolHarness({
  args,
  respond,
  tool,
}: {
  args: Record<string, unknown>;
  respond: (result: unknown) => Promise<void>;
  tool: HumanInTheLoopToolConfig;
}) {
  return (
    <>
      {tool.render({
        args,
        description: "Control task",
        name: tool.name,
        respond,
        result: undefined,
        status: "executing",
        toolCallId: "tool-call-control-task",
      })}
    </>
  );
}

function AskQuestionToolHarness({
  respond,
  tool,
}: {
  respond: (result: unknown) => Promise<void>;
  tool: HumanInTheLoopToolConfig;
}) {
  return (
    <>
      {tool.render({
        args: {
          choices: [
            {
              description: "批量屏蔽 3 条评论。",
              id: "approve_all",
              label: "确认屏蔽",
              operations: [
                {
                  resume: {
                    decision: "APPROVE",
                    findingIds: ["finding-1", "finding-2", "finding-3"],
                  },
                  taskId: "run-approval",
                  type: "agent_task_resume",
                },
              ],
            },
            {
              description: "暂不执行写操作。",
              id: "defer",
              label: "暂不处理",
            },
          ],
          context: "这会修改评论状态。",
          question: "是否确认屏蔽 3 条评论？",
        },
        description: "Ask user question",
        name: tool.name,
        respond,
        result: undefined,
        status: "executing",
        toolCallId: "tool-call-question",
      })}
    </>
  );
}

function createHomeResponse(
  overrides: Partial<AdminAgentHomeResponse> = {},
): AdminAgentHomeResponse {
  return {
    assistantBrief: "今天没有待处理风险。",
    automationCandidateCount: 0,
    automationPolicy: {
      autoHideEnabled: false,
      confidenceThreshold: 0.9,
      eligibleCategories: ["SPAM"],
      mode: "MANUAL_REVIEW",
      requiresStrongEvidence: true,
    },
    capabilities: [],
    executedActionCount: 0,
    findings: [],
    lastUpdatedAt: "2026-07-04T05:00:00.000Z",
    pendingFindingCount: 0,
    recentActions: [],
    tasks: [...adminAgentTaskCatalog],
    todayCommentCount: 0,
    todayHiddenCommentCount: 0,
    todayVisibleCommentCount: 0,
    ...overrides,
  };
}

function createTask(
  overrides: Partial<AdminAgentTaskSummaryResponse> = {},
): AdminAgentTaskSummaryResponse {
  return {
    createdAt: "2026-07-04T05:00:00.000Z",
    errorMessage: null,
    id: "run-source",
    latestEvent: null,
    parentTaskId: null,
    relation: null,
    status: "WAITING_FOR_APPROVAL",
    summary: "评论治理等待确认。",
    taskName: "comment_moderation_analysis",
    updatedAt: "2026-07-04T05:00:01.000Z",
    ...overrides,
  };
}

type HumanInTheLoopToolConfig = {
  description: string;
  name: string;
  render: (props: {
    args: Record<string, unknown>;
    description: string;
    name: string;
    respond?: (result: unknown) => Promise<void>;
    result?: string;
    status: "inProgress" | "executing" | "complete";
    toolCallId: string;
  }) => ReactNode;
};
