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

function createAdminOperationSummary(input: AdminOperationSummaryInput) {
  const metadata = input.metadata ?? {};

  if (input.action === "COMMENT_STATUS_UPDATED") {
    return `评论已设为${toStatusLabel(metadata.status) || "新状态"}`;
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

  if (input.action === "ARTICLE_CATEGORY_CREATED") {
    return "创建文章分类";
  }

  if (input.action === "ARTICLE_CATEGORY_UPDATED") {
    return "更新文章分类";
  }

  if (input.action === "ARTICLE_CATEGORY_DELETED") {
    return "删除文章分类";
  }

  if (input.action === "ARTICLE_TAG_CREATED") return "创建文章标签";
  if (input.action === "ARTICLE_TAG_UPDATED") return "更新文章标签";
  if (input.action === "ARTICLE_TAG_DELETED") return "删除文章标签";
  if (input.action === "ARTICLE_TAG_MERGED") return "合并文章标签";

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
  const articleTitle = toDisplayText(metadata.articleTitle);

  if (articleTitle) {
    return `《${articleTitle}》`;
  }

  return (
    toDisplayText(metadata.articleSlug) ||
    toDisplayText(metadata.slug) ||
    toShortReference(resourceId)
  );
}

function toStatusLabel(value: unknown) {
  const text = toDisplayText(value);
  return text ? (statusLabels[text] ?? text) : "";
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
