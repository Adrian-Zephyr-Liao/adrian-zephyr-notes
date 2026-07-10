import { adminAgentTaskCatalog } from "@adrian-zephyr-notes/contracts";
import type { AdminOperationLogResponse } from "@adrian-zephyr-notes/contracts";

type AuditMetadataEntry = {
  key: string;
  label: string;
  value: string;
};

const knownMetadataFields = [
  ["agentFindingId", "建议编号"],
  ["findingCount", "建议数量"],
  ["action", "处理方式"],
  ["decision", "Agent 决策"],
  ["status", "评论状态"],
  ["taskTitle", "处理事项"],
  ["targetId", "目标评论"],
  ["targetIds", "目标评论"],
  ["articleSlug", "文章"],
  ["source", "来源"],
] as const;

const hiddenMetadataFields = new Set([
  "agentRunId",
  "agentTaskId",
  "checkpointId",
  "currentNode",
  "langGraphRunId",
  "node",
  "runId",
  "taskName",
  "threadId",
  "workflowName",
  "workflowRunId",
]);

const hiddenMetadataFieldPatterns = [
  /checkpoint/i,
  /lang[_-]?graph/i,
  /run[_-]?id/i,
  /^node$/i,
  /raw.*state/i,
  /runtime/i,
  /^thread/i,
  /thread[_-]?id/i,
  /workflow/i,
];

const internalSummaryPatterns = [
  /agent[./_-]?runs/i,
  /checkpoint/i,
  /debug/i,
  /lang[_-]?graph/i,
  /runtime/i,
  /runtime\s*panel/i,
  /thread[_-]?id/i,
  /workflow(?:Name|RunId)?/i,
  /运行面板/,
  /运行态/,
  /运行时/,
];

const metadataValueLabel: Record<string, string> = {
  EXECUTE_PROPOSED_ACTION: "批准屏蔽",
  HIDDEN: "已隐藏",
  REJECT: "忽略建议",
  RESTORE_COMMENT: "恢复误判",
  VISIBLE: "可见",
  admin_agent: "Agent 工作台",
};

const agentTaskTitleByName: Record<string, string> = Object.fromEntries(
  adminAgentTaskCatalog.map((task) => [task.taskName, task.title]),
);

const taskControlActionLabels: Record<string, string> = {
  branch: "另开处理",
  cancel: "取消处理",
  refresh: "刷新结果",
  retry: "重新处理",
};

const auditResourceTypeLabel: Record<string, string> = {
  ADMIN_AGENT_TASK: "Agent 操作",
  article: "文章",
  article_comment: "评论",
  guestbook_message: "留言",
  site_announcement: "站点公告",
  site_settings: "站点配置",
};

function formatAuditMetadataEntries(
  metadata: AdminOperationLogResponse["metadata"],
): AuditMetadataEntry[] {
  if (!metadata) {
    return [];
  }

  const entries: AuditMetadataEntry[] = [];

  for (const [key, label] of knownMetadataFields) {
    const value = formatMetadataValue(metadata[key]);

    if (value) {
      entries.push({
        key,
        label,
        value,
      });
    }
  }

  return entries;
}

function isHiddenMetadataField(key: string) {
  return (
    hiddenMetadataFields.has(key) ||
    hiddenMetadataFieldPatterns.some((pattern) => pattern.test(key))
  );
}

function formatMetadataValue(value: unknown): string {
  const displayValue = sanitizeMetadataValue(value);

  if (displayValue == null) {
    return "";
  }

  if (typeof displayValue === "string") {
    const normalized = displayValue.trim();
    return metadataValueLabel[normalized] ?? formatReadableIdentifier(normalized);
  }

  if (typeof displayValue === "number" || typeof displayValue === "boolean") {
    return String(displayValue);
  }

  if (Array.isArray(displayValue)) {
    return displayValue
      .map((item) => formatMetadataValue(item))
      .filter(Boolean)
      .join("、");
  }

  return JSON.stringify(displayValue);
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => sanitizeMetadataValue(item))
      .filter((item) => !isEmptyMetadataValue(item));

    return items.length > 0 ? items : null;
  }

  if (typeof value === "string" && isInternalMetadataValue(value)) {
    return null;
  }

  if (!isPlainMetadataObject(value)) {
    return value;
  }

  const entries = Object.entries(value)
    .filter(([key]) => !isHiddenMetadataField(key))
    .map(([key, item]) => [key, sanitizeMetadataValue(item)] as const)
    .filter(([, item]) => !isEmptyMetadataValue(item));

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function isPlainMetadataObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isEmptyMetadataValue(value: unknown) {
  return value == null || (Array.isArray(value) && value.length === 0);
}

function isInternalMetadataValue(value: string) {
  return internalSummaryPatterns.some((pattern) => pattern.test(value));
}

function formatAuditSummary(log: AdminOperationLogResponse) {
  const metadata = log.metadata ?? {};

  if (log.action === "COMMENT_STATUS_UPDATED") {
    return `评论已设为${formatMetadataValue(metadata.status) || "新状态"}`;
  }

  if (log.action === "ADMIN_AGENT_FINDING_DECIDED") {
    return `管理员已${formatMetadataValue(metadata.decision) || "处理"} Agent 建议`;
  }

  if (log.action === "ADMIN_AGENT_FINDING_CREATED") {
    const findingCount = formatMetadataValue(metadata.findingCount);
    return findingCount ? `Agent 生成 ${findingCount} 条风险建议` : "Agent 生成风险建议";
  }

  if (log.action === "ADMIN_AGENT_TASK_STARTED") {
    return `发起${formatAgentTaskReference(log)}`;
  }

  if (log.action === "ADMIN_AGENT_TASK_CONTROLLED") {
    const actionLabel = formatTaskControlAction(metadata.action) || "控制";
    return `${actionLabel}${formatAgentTaskReference(log)}`;
  }

  if (log.action === "ADMIN_AGENT_TASK_RESUMED") {
    return `确认${formatAgentTaskReference(log)}`;
  }

  if (log.action === "ARTICLE_CREATED") {
    return `创建文章 ${formatMetadataValue(metadata.articleSlug) || extractTrailingSummaryValue(log.summary)}`;
  }

  if (log.action === "ARTICLE_UPDATED") {
    return `更新文章 ${formatMetadataValue(metadata.articleSlug) || extractTrailingSummaryValue(log.summary)}`;
  }

  if (log.action === "ARTICLE_DELETED") {
    return `删除文章 ${formatMetadataValue(metadata.articleSlug) || extractTrailingSummaryValue(log.summary)}`;
  }

  if (log.action === "SITE_ANNOUNCEMENT_UPDATED") {
    return "更新站点公告";
  }

  if (log.action === "SITE_SETTINGS_UPDATED") {
    return "更新站点配置";
  }

  if (log.action === "GUESTBOOK_MESSAGE_UPDATED") {
    return "更新留言状态";
  }

  return formatSafeAuditSummary(log.summary);
}

function formatAuditResourceLabel(log: AdminOperationLogResponse) {
  const label = auditResourceTypeLabel[log.resourceType] ?? log.resourceType;
  const readableId = log.resourceId ? formatReadableIdentifier(log.resourceId) : "";

  return readableId ? `${label} / ${readableId}` : label;
}

function formatAgentTaskReference(log: AdminOperationLogResponse) {
  const metadata = log.metadata ?? {};
  const taskTitle = formatPlainMetadataText(metadata.taskTitle);

  if (taskTitle) {
    return taskTitle;
  }

  const taskName = formatPlainMetadataText(metadata.taskName);

  if (taskName) {
    return agentTaskTitleByName[taskName] ?? "Agent 操作";
  }

  return "Agent 操作";
}

function formatTaskControlAction(value: unknown) {
  const text = formatPlainMetadataText(value);
  return text ? (taskControlActionLabels[text] ?? text) : "";
}

function formatPlainMetadataText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatAuditClientLabel(log: AdminOperationLogResponse) {
  const source = log.metadata?.source === "admin_agent" ? "Agent 工作台" : "管理后台";
  const client = formatUserAgent(log.userAgent);
  const ipAddress = formatIpAddress(log.ipAddress);

  return [source, client, ipAddress].filter(Boolean).join(" · ");
}

function formatReadableIdentifier(value: string) {
  if (isUuidLike(value)) {
    return `${value.slice(0, 8)}...`;
  }

  return value;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function formatUserAgent(userAgent: string | null) {
  if (!userAgent) {
    return "未知客户端";
  }

  if (userAgent.includes("curl/")) {
    return "接口调用";
  }

  if (userAgent.includes("Chrome/")) {
    return "浏览器";
  }

  return "客户端";
}

function formatIpAddress(ipAddress: string | null) {
  if (!ipAddress) {
    return "未知网络";
  }

  if (ipAddress === "::1" || ipAddress === "127.0.0.1" || ipAddress === "::ffff:127.0.0.1") {
    return "本机";
  }

  return ipAddress;
}

function extractTrailingSummaryValue(summary: string) {
  const value = summary.split(" ").pop()?.trim();
  return value ? formatReadableIdentifier(value) : "";
}

function formatSafeAuditSummary(summary: string) {
  return internalSummaryPatterns.some((pattern) => pattern.test(summary))
    ? "记录了一次后台操作"
    : summary;
}

export {
  formatAuditClientLabel,
  formatAuditMetadataEntries,
  formatAuditResourceLabel,
  formatAuditSummary,
};
export type { AuditMetadataEntry };
