import { describe, expect, it } from "vitest";
import {
  adminAgentWorkflowNodeLabels,
  toAdminAgentWorkflowNodeLabel,
} from "./admin-agent-workflow-node";

describe("admin agent workflow nodes", () => {
  it("keeps known LangGraph nodes mapped to business labels", () => {
    expect(adminAgentWorkflowNodeLabels).toMatchObject({
      analyze_comments: "分析评论",
      request_multi_task_approval: "等待管理员确认",
      run_child_tasks: "启动子任务",
    });
  });

  it("falls back for unknown or empty node names", () => {
    expect(toAdminAgentWorkflowNodeLabel("unknown_node")).toBe("当前任务");
    expect(toAdminAgentWorkflowNodeLabel(null)).toBe("当前任务");
  });
});
