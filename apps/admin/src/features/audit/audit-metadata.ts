import type { AdminOperationLogResponse } from "@adrian-zephyr-notes/contracts";

type AuditMetadataEntry = {
  key: string;
  label: string;
  value: string;
};

const knownMetadataFields = [
  ["source", "来源"],
  ["status", "评论状态"],
  ["targetId", "目标评论"],
  ["targetIds", "目标评论"],
  ["articleSlug", "文章"],
  ["articleTitle", "文章标题"],
] as const;

const metadataValueLabel: Record<string, string> = {
  assistant: "助手",
  HIDDEN: "已隐藏",
  VISIBLE: "可见",
};

const auditResourceTypeLabel: Record<string, string> = {
  article: "文章",
  article_comment: "评论",
  guestbook_message: "留言",
  site_announcement: "站点公告",
  site_settings: "站点配置",
};

function formatAuditMetadataEntries(
  metadata: AdminOperationLogResponse["metadata"],
): AuditMetadataEntry[] {
  if (!metadata) return [];

  return knownMetadataFields.flatMap(([key, label]) => {
    const value = formatMetadataValue(metadata[key]);
    return value ? [{ key, label, value }] : [];
  });
}

function formatMetadataValue(value: unknown): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    return metadataValueLabel[normalized] ?? formatReadableIdentifier(normalized);
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(formatMetadataValue).filter(Boolean).join("、");
  return "";
}

function formatAuditSummary(log: AdminOperationLogResponse) {
  const metadata = log.metadata ?? {};

  if (log.action === "COMMENT_STATUS_UPDATED") {
    return `评论已设为${formatMetadataValue(metadata.status) || "新状态"}`;
  }
  if (log.action === "ARTICLE_CREATED") return `创建文章 ${formatArticleReference(log)}`;
  if (log.action === "ARTICLE_UPDATED") return `更新文章 ${formatArticleReference(log)}`;
  if (log.action === "ARTICLE_DELETED") return `删除文章 ${formatArticleReference(log)}`;
  if (log.action === "ARTICLE_CATEGORY_CREATED") return "创建文章分类";
  if (log.action === "ARTICLE_CATEGORY_UPDATED") return "更新文章分类";
  if (log.action === "ARTICLE_CATEGORY_DELETED") return "删除文章分类";
  if (log.action === "ARTICLE_TAG_CREATED") return "创建文章标签";
  if (log.action === "ARTICLE_TAG_UPDATED") return "更新文章标签";
  if (log.action === "ARTICLE_TAG_DELETED") return "删除文章标签";
  if (log.action === "ARTICLE_TAG_MERGED") return "合并文章标签";
  if (log.action === "SITE_ANNOUNCEMENT_UPDATED") return "更新站点公告";
  if (log.action === "SITE_SETTINGS_UPDATED") return "更新站点配置";
  if (log.action === "GUESTBOOK_MESSAGE_UPDATED") return "更新留言状态";
  return log.summary;
}

function formatArticleReference(log: AdminOperationLogResponse) {
  const articleTitle = log.metadata?.articleTitle;
  if (typeof articleTitle === "string" && articleTitle.trim()) return `《${articleTitle.trim()}》`;
  return formatMetadataValue(log.metadata?.articleSlug) || extractTrailingSummaryValue(log.summary);
}

function formatAuditResourceLabel(log: AdminOperationLogResponse) {
  const label = auditResourceTypeLabel[log.resourceType] ?? log.resourceType;
  const readableId = log.resourceId ? formatReadableIdentifier(log.resourceId) : "";
  return readableId ? `${label} / ${readableId}` : label;
}

function formatAuditClientLabel(log: AdminOperationLogResponse) {
  const source = log.metadata?.source === "assistant" ? "助手" : "管理后台";
  return [source, formatUserAgent(log.userAgent), formatIpAddress(log.ipAddress)].join(" · ");
}

function formatReadableIdentifier(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? `${value.slice(0, 8)}...`
    : value;
}

function formatUserAgent(userAgent: string | null) {
  if (!userAgent) return "未知客户端";
  if (userAgent.includes("curl/")) return "接口调用";
  if (userAgent.includes("Chrome/")) return "浏览器";
  return "客户端";
}

function formatIpAddress(ipAddress: string | null) {
  if (!ipAddress) return "未知网络";
  if (["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(ipAddress)) return "本机";
  return ipAddress;
}

function extractTrailingSummaryValue(summary: string) {
  const value = summary.split(" ").pop()?.trim();
  return value ? formatReadableIdentifier(value) : "";
}

export {
  formatAuditClientLabel,
  formatAuditMetadataEntries,
  formatAuditResourceLabel,
  formatAuditSummary,
};
export type { AuditMetadataEntry };
