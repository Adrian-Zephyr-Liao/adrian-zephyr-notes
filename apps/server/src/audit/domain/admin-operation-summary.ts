import type { AdminOperationLogAction } from "./admin-operation-log";

type AdminOperationSummaryInput = {
  action: AdminOperationLogAction;
  metadata?: Record<string, unknown> | null;
  resourceId?: string | null;
  resourceType: string;
};

const statusLabels: Record<string, string> = {
  HIDDEN: "已隐藏",
  PUBLISHED: "已发布",
  VISIBLE: "可见",
};

const decisionLabels: Record<string, string> = {
  EXECUTE_PROPOSED_ACTION: "批准屏蔽",
  REJECT: "忽略",
  RESTORE_COMMENT: "恢复误判",
};

const taskControlActionLabels: Record<string, string> = {
  branch: "另开处理",
  cancel: "取消处理",
  refresh: "刷新结果",
  retry: "重新处理",
};

const agentTaskLabels: Record<string, string> = {
  article_assistance: "文章协作",
  audit_review: "审计分析",
  comment_moderation_analysis: "评论治理分析",
  multi_task_orchestration: "跨域协作",
  site_config_review: "站点巡检",
};

function createAdminOperationSummary(input: AdminOperationSummaryInput) {
  const metadata = input.metadata ?? {};

  if (input.action === "COMMENT_STATUS_UPDATED") {
    return `评论已设为${toStatusLabel(metadata.status) || "新状态"}`;
  }

  if (input.action === "ADMIN_AGENT_FINDING_DECIDED") {
    return `管理员已${toDecisionLabel(metadata.decision) || "处理"} Agent 建议`;
  }

  if (input.action === "ADMIN_AGENT_FINDING_CREATED") {
    const findingCount = toDisplayText(metadata.findingCount);
    return findingCount ? `Agent 生成 ${findingCount} 条风险建议` : "Agent 生成风险建议";
  }

  if (input.action === "ADMIN_AGENT_TASK_STARTED") {
    return `发起${toTaskReference(metadata, input.resourceId)}`;
  }

  if (input.action === "ADMIN_AGENT_TASK_CONTROLLED") {
    return `${toTaskControlActionLabel(metadata.action) || "控制"}${toTaskReference(metadata, input.resourceId)}`;
  }

  if (input.action === "ADMIN_AGENT_TASK_RESUMED") {
    return `确认${toTaskReference(metadata, input.resourceId)}`;
  }

  if (input.action === "ARTICLE_CREATED") {
    return `创建文章 ${toArticleReference(metadata, input.resourceId)}`;
  }

  if (input.action === "ARTICLE_UPDATED") {
    return `更新文章 ${toArticleReference(metadata, input.resourceId)}`;
  }

  if (input.action === "ARTICLE_DELETED") {
    return `删除文章 ${toArticleReference(metadata, input.resourceId)}`;
  }

  if (input.action === "SITE_ANNOUNCEMENT_UPDATED") {
    return `更新站点公告 ${toDisplayText(metadata.key) || toShortReference(input.resourceId)}`;
  }

  if (input.action === "SITE_SETTINGS_UPDATED") {
    return "更新站点配置";
  }

  if (input.action === "GUESTBOOK_MESSAGE_UPDATED") {
    return `更新留言 ${toShortReference(input.resourceId)}`;
  }

  return `记录${input.resourceType}操作`;
}

function toArticleReference(metadata: Record<string, unknown>, resourceId?: string | null) {
  return (
    toDisplayText(metadata.articleSlug) ||
    toDisplayText(metadata.slug) ||
    toShortReference(resourceId)
  );
}

function toTaskReference(metadata: Record<string, unknown>, resourceId?: string | null) {
  const taskTitle = toDisplayText(metadata.taskTitle);

  if (taskTitle) {
    return taskTitle;
  }

  const taskName = toDisplayText(metadata.taskName);

  if (taskName) {
    return agentTaskLabels[taskName] ?? "Agent 操作";
  }

  const reference = toShortReference(resourceId);
  return reference === "未知对象" ? "Agent 操作" : `Agent 操作 ${reference}`;
}

function toTaskControlActionLabel(value: unknown) {
  const text = toDisplayText(value);
  return text ? (taskControlActionLabels[text] ?? text) : "";
}

function toStatusLabel(value: unknown) {
  const text = toDisplayText(value);
  return text ? (statusLabels[text] ?? text) : "";
}

function toDecisionLabel(value: unknown) {
  const text = toDisplayText(value);
  return text ? (decisionLabels[text] ?? text) : "";
}

function toDisplayText(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function toShortReference(value: string | null | undefined) {
  const normalized = value?.trim();

  if (!normalized) {
    return "未知对象";
  }

  return isUuidLike(normalized) ? `${normalized.slice(0, 8)}...` : normalized;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export { createAdminOperationSummary };
export type { AdminOperationSummaryInput };
