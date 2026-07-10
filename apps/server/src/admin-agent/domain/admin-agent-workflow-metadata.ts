import {
  adminAgentTaskCatalog,
  type AdminAgentTaskCatalogItem,
  type AdminAgentTaskControlAction,
  type AdminAgentTaskControlCatalogItem,
  type AdminAgentTaskName,
} from "@adrian-zephyr-notes/contracts";
import type { AdminAgentRunType, AdminAgentWorkflowName } from "./admin-agent-run.entity";
import type { AdminAgentWorkflowNode } from "./admin-agent-workflow-node";

type AdminAgentWorkflowTaskName = AdminAgentTaskName;

type AdminAgentWorkflowMetadata = {
  approvalNode: AdminAgentWorkflowNode;
  capabilityId: AdminAgentTaskCatalogItem["capabilityId"];
  controls: AdminAgentTaskCatalogItem["controls"];
  description: string;
  graphName: string;
  label: string;
  requiresApprovalForWrites: boolean;
  runType: AdminAgentRunType;
  supportsBranch: boolean;
  supportsCancel: boolean;
  supportsRefresh: boolean;
  supportsHumanApproval: boolean;
  supportsRetry: boolean;
  supportsStart: boolean;
  taskName: AdminAgentWorkflowTaskName;
  workflowName: AdminAgentWorkflowName;
};
type AdminAgentWorkflowTaskCatalogItem = AdminAgentTaskCatalogItem;
type AdminAgentWorkflowTaskControlAction = AdminAgentTaskControlAction;
type AdminAgentWorkflowTaskControlCatalogItem = AdminAgentTaskControlCatalogItem;

type AdminAgentWorkflowPrivateMetadata = {
  approvalNode: AdminAgentWorkflowNode;
  graphName: string;
  runType: AdminAgentRunType;
  taskName: AdminAgentWorkflowTaskName;
  workflowName: AdminAgentWorkflowName;
};

const adminAgentWorkflowPrivateMetadataCatalog = [
  {
    approvalNode: "human_approval",
    graphName: "commentModerationWorkflow",
    runType: "COMMENT_MODERATION_TODAY",
    taskName: "comment_moderation_analysis",
    workflowName: "COMMENT_MODERATION_ANALYSIS",
  },
  {
    approvalNode: "request_article_approval",
    graphName: "articleAssistanceWorkflow",
    runType: "ARTICLE_ASSISTANCE",
    taskName: "article_assistance",
    workflowName: "ARTICLE_ASSISTANCE",
  },
  {
    approvalNode: "request_site_config_approval",
    graphName: "siteConfigReviewWorkflow",
    runType: "SITE_CONFIG_REVIEW",
    taskName: "site_config_review",
    workflowName: "SITE_CONFIG_REVIEW",
  },
  {
    approvalNode: "request_audit_approval",
    graphName: "auditReviewWorkflow",
    runType: "AUDIT_REVIEW",
    taskName: "audit_review",
    workflowName: "AUDIT_REVIEW",
  },
  {
    approvalNode: "request_multi_task_approval",
    graphName: "multiTaskOrchestrationWorkflow",
    runType: "MULTI_TASK_ORCHESTRATION",
    taskName: "multi_task_orchestration",
    workflowName: "MULTI_TASK_ORCHESTRATION",
  },
] as const satisfies readonly AdminAgentWorkflowPrivateMetadata[];

const adminAgentWorkflowMetadataCatalog = adminAgentWorkflowPrivateMetadataCatalog.map(
  toAdminAgentWorkflowMetadata,
);

function listAdminAgentWorkflowMetadata() {
  return [...adminAgentWorkflowMetadataCatalog];
}

function listAdminAgentWorkflowTasks(): AdminAgentWorkflowTaskCatalogItem[] {
  return [...adminAgentTaskCatalog];
}

function listTaskControls(
  metadata: AdminAgentWorkflowMetadata,
): AdminAgentWorkflowTaskControlCatalogItem[] {
  return [...metadata.controls];
}

function isAdminAgentWorkflowControlActionSupported(
  workflowName: AdminAgentWorkflowName,
  action: AdminAgentWorkflowTaskControlAction,
) {
  return getAdminAgentWorkflowControl(workflowName, action) != null;
}

function getAdminAgentWorkflowControl(
  workflowName: AdminAgentWorkflowName,
  action: AdminAgentWorkflowTaskControlAction,
) {
  return (
    listTaskControls(getAdminAgentWorkflowMetadata(workflowName)).find(
      (control) => control.action === action,
    ) ?? null
  );
}

function isAdminAgentWorkflowStartSupported(workflowName: AdminAgentWorkflowName) {
  return getAdminAgentWorkflowMetadata(workflowName).supportsStart;
}

function isAdminAgentWorkflowHumanApprovalSupported(workflowName: AdminAgentWorkflowName) {
  return getAdminAgentWorkflowMetadata(workflowName).supportsHumanApproval;
}

function getAdminAgentWorkflowMetadata(workflowName: AdminAgentWorkflowName) {
  const metadata = adminAgentWorkflowMetadataCatalog.find(
    (item) => item.workflowName === workflowName,
  );

  if (!metadata) {
    throw new Error(`Unsupported admin agent workflow metadata: ${workflowName}`);
  }

  return metadata;
}

function findAdminAgentWorkflowMetadataByTaskName(taskName: string) {
  return adminAgentWorkflowMetadataCatalog.find((item) => item.taskName === taskName) ?? null;
}

function toAdminAgentTaskName(workflowName: AdminAgentWorkflowName) {
  return getAdminAgentWorkflowMetadata(workflowName).taskName;
}

function toAdminAgentRunType(workflowName: AdminAgentWorkflowName) {
  return getAdminAgentWorkflowMetadata(workflowName).runType;
}

function toAdminAgentWorkflowGraphName(workflowName: AdminAgentWorkflowName) {
  return getAdminAgentWorkflowMetadata(workflowName).graphName;
}

function toAdminAgentWorkflowLabel(workflowName: AdminAgentWorkflowName) {
  return getAdminAgentWorkflowMetadata(workflowName).label;
}

function toAdminAgentWorkflowApprovalNode(workflowName: AdminAgentWorkflowName) {
  return getAdminAgentWorkflowMetadata(workflowName).approvalNode;
}

function toAdminAgentWorkflowNameFromTaskName(taskName: AdminAgentWorkflowTaskName) {
  return getAdminAgentWorkflowMetadataByTaskName(taskName).workflowName;
}

function getAdminAgentWorkflowMetadataByTaskName(taskName: AdminAgentWorkflowTaskName) {
  const metadata = findAdminAgentWorkflowMetadataByTaskName(taskName);

  if (!metadata) {
    throw new Error(`Unsupported admin agent task metadata: ${taskName}`);
  }

  return metadata;
}

function toAdminAgentWorkflowMetadata(
  metadata: AdminAgentWorkflowPrivateMetadata,
): AdminAgentWorkflowMetadata {
  const task = getAdminAgentTaskCatalogItem(metadata.taskName);

  return {
    approvalNode: metadata.approvalNode,
    capabilityId: task.capabilityId,
    controls: task.controls,
    description: task.description,
    graphName: metadata.graphName,
    label: task.title,
    requiresApprovalForWrites: task.requiresApprovalForWrites,
    runType: metadata.runType,
    supportsBranch: hasTaskControl(task, "branch"),
    supportsCancel: hasTaskControl(task, "cancel"),
    supportsRefresh: hasTaskControl(task, "refresh"),
    supportsHumanApproval: task.supportsHumanApproval,
    supportsRetry: hasTaskControl(task, "retry"),
    supportsStart: task.supportsStart,
    taskName: task.taskName,
    workflowName: metadata.workflowName,
  };
}

function getAdminAgentTaskCatalogItem(taskName: AdminAgentWorkflowTaskName) {
  const task = adminAgentTaskCatalog.find((item) => item.taskName === taskName);

  if (!task) {
    throw new Error(`Unsupported admin agent public task metadata: ${taskName}`);
  }

  return task;
}

function hasTaskControl(
  task: AdminAgentTaskCatalogItem,
  action: AdminAgentWorkflowTaskControlAction,
) {
  return task.controls.some((control) => control.action === action);
}

export {
  findAdminAgentWorkflowMetadataByTaskName,
  getAdminAgentWorkflowControl,
  getAdminAgentWorkflowMetadata,
  getAdminAgentWorkflowMetadataByTaskName,
  isAdminAgentWorkflowControlActionSupported,
  isAdminAgentWorkflowHumanApprovalSupported,
  isAdminAgentWorkflowStartSupported,
  listAdminAgentWorkflowMetadata,
  listAdminAgentWorkflowTasks,
  toAdminAgentRunType,
  toAdminAgentTaskName,
  toAdminAgentWorkflowApprovalNode,
  toAdminAgentWorkflowGraphName,
  toAdminAgentWorkflowLabel,
  toAdminAgentWorkflowNameFromTaskName,
};
export type {
  AdminAgentWorkflowMetadata,
  AdminAgentWorkflowTaskControlAction,
  AdminAgentWorkflowTaskControlCatalogItem,
  AdminAgentWorkflowTaskCatalogItem,
  AdminAgentWorkflowTaskName,
};
