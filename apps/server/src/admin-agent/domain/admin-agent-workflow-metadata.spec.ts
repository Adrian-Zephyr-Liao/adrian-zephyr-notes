import { describe, expect, it } from "vitest";
import {
  adminAgentTaskCatalog,
  startableAdminAgentTaskNames,
} from "@adrian-zephyr-notes/contracts";
import {
  findAdminAgentWorkflowMetadataByTaskName,
  getAdminAgentWorkflowControl,
  isAdminAgentWorkflowControlActionSupported,
  isAdminAgentWorkflowHumanApprovalSupported,
  isAdminAgentWorkflowStartSupported,
  listAdminAgentWorkflowMetadata,
  listAdminAgentWorkflowTasks,
  toAdminAgentRunType,
  toAdminAgentTaskName,
  toAdminAgentWorkflowApprovalNode,
  toAdminAgentWorkflowLabel,
  toAdminAgentWorkflowNameFromTaskName,
} from "./admin-agent-workflow-metadata";

describe("admin agent workflow metadata", () => {
  it("keeps workflow registration order and public task names in one catalog", () => {
    expect(
      listAdminAgentWorkflowMetadata().map((item) => ({
        approvalNode: item.approvalNode,
        graphName: item.graphName,
        requiresApprovalForWrites: item.requiresApprovalForWrites,
        runType: item.runType,
        supportsCancel: item.supportsCancel,
        supportsHumanApproval: item.supportsHumanApproval,
        taskName: item.taskName,
        workflowName: item.workflowName,
      })),
    ).toEqual([
      {
        approvalNode: null,
        graphName: "commentModerationWorkflow",
        requiresApprovalForWrites: false,
        runType: "COMMENT_MODERATION_TODAY",
        supportsCancel: true,
        supportsHumanApproval: false,
        taskName: "comment_moderation_analysis",
        workflowName: "COMMENT_MODERATION_ANALYSIS",
      },
      {
        approvalNode: "request_article_approval",
        graphName: "articleAssistanceWorkflow",
        requiresApprovalForWrites: false,
        runType: "ARTICLE_ASSISTANCE",
        supportsCancel: true,
        supportsHumanApproval: true,
        taskName: "article_assistance",
        workflowName: "ARTICLE_ASSISTANCE",
      },
      {
        approvalNode: "request_site_config_approval",
        graphName: "siteConfigReviewWorkflow",
        requiresApprovalForWrites: true,
        runType: "SITE_CONFIG_REVIEW",
        supportsCancel: true,
        supportsHumanApproval: true,
        taskName: "site_config_review",
        workflowName: "SITE_CONFIG_REVIEW",
      },
      {
        approvalNode: "request_audit_approval",
        graphName: "auditReviewWorkflow",
        requiresApprovalForWrites: false,
        runType: "AUDIT_REVIEW",
        supportsCancel: true,
        supportsHumanApproval: true,
        taskName: "audit_review",
        workflowName: "AUDIT_REVIEW",
      },
      {
        approvalNode: "request_multi_task_approval",
        graphName: "multiTaskOrchestrationWorkflow",
        requiresApprovalForWrites: true,
        runType: "MULTI_TASK_ORCHESTRATION",
        supportsCancel: true,
        supportsHumanApproval: true,
        taskName: "multi_task_orchestration",
        workflowName: "MULTI_TASK_ORCHESTRATION",
      },
    ]);
  });

  it("maps between workflow names, public task names, run types, and labels", () => {
    expect(toAdminAgentTaskName("COMMENT_MODERATION_ANALYSIS")).toBe("comment_moderation_analysis");
    expect(toAdminAgentRunType("COMMENT_MODERATION_ANALYSIS")).toBe("COMMENT_MODERATION_TODAY");
    expect(toAdminAgentWorkflowNameFromTaskName("site_config_review")).toBe("SITE_CONFIG_REVIEW");
    expect(toAdminAgentWorkflowLabel("AUDIT_REVIEW")).toBe("审计分析");
    expect(toAdminAgentWorkflowApprovalNode("MULTI_TASK_ORCHESTRATION")).toBe(
      "request_multi_task_approval",
    );
  });

  it("returns null for unknown public task names", () => {
    expect(findAdminAgentWorkflowMetadataByTaskName("unknown")).toBeNull();
  });

  it("keeps the public task catalog synchronized with the workflow metadata", () => {
    expect(listAdminAgentWorkflowTasks()).toEqual(adminAgentTaskCatalog);
    expect(listAdminAgentWorkflowMetadata().map((metadata) => metadata.taskName)).toEqual(
      startableAdminAgentTaskNames,
    );
  });

  it("uses the same catalog to decide backend control-action support", () => {
    for (const task of listAdminAgentWorkflowTasks()) {
      const workflowName = toAdminAgentWorkflowNameFromTaskName(task.taskName);

      expect(isAdminAgentWorkflowControlActionSupported(workflowName, "branch")).toBe(
        task.controls.some((control) => control.action === "branch"),
      );
      expect(isAdminAgentWorkflowControlActionSupported(workflowName, "cancel")).toBe(
        task.controls.some((control) => control.action === "cancel"),
      );
      expect(isAdminAgentWorkflowControlActionSupported(workflowName, "retry")).toBe(
        task.controls.some((control) => control.action === "retry"),
      );
      expect(isAdminAgentWorkflowControlActionSupported(workflowName, "refresh")).toBe(
        task.controls.some((control) => control.action === "refresh"),
      );
    }
  });

  it("exposes control action policy from the shared catalog", () => {
    expect(getAdminAgentWorkflowControl("COMMENT_MODERATION_ANALYSIS", "branch")).toBeNull();
    expect(getAdminAgentWorkflowControl("COMMENT_MODERATION_ANALYSIS", "refresh")).toBeNull();
    expect(getAdminAgentWorkflowControl("COMMENT_MODERATION_ANALYSIS", "retry")).toEqual(
      expect.objectContaining({
        action: "retry",
        allowedStatuses: ["COMPLETED", "FAILED", "CANCELLED"],
        requiresPausedTask: false,
      }),
    );
    expect(getAdminAgentWorkflowControl("MULTI_TASK_ORCHESTRATION", "refresh")).toEqual(
      expect.objectContaining({
        action: "refresh",
        allowedStatuses: ["COMPLETED", "FAILED"],
        requiresPausedTask: false,
      }),
    );
  });

  it("uses the same catalog to decide start and approval-resume support", () => {
    for (const task of listAdminAgentWorkflowTasks()) {
      const workflowName = toAdminAgentWorkflowNameFromTaskName(task.taskName);

      expect(isAdminAgentWorkflowStartSupported(workflowName)).toBe(task.supportsStart);
      expect(isAdminAgentWorkflowHumanApprovalSupported(workflowName)).toBe(
        task.supportsHumanApproval,
      );
    }
  });
});
