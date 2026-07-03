import type {
  AdminArticleDetailResponse,
  AdminArticleStatus,
  CreateAdminArticleRequest,
} from "@adrian-zephyr-notes/contracts";
import type { ArticleEditorValues } from "./article-editor";

const emptyArticleEditorValues: ArticleEditorValues = {
  categorySlug: "",
  coverImageUrl: "",
  description: "",
  markdown: "# 新文章\n\n从这里开始写。",
  status: "DRAFT",
  tagSlugs: [],
  title: "",
};

function createNewArticleEditorValues(): ArticleEditorValues {
  return {
    ...emptyArticleEditorValues,
    title: createDefaultArticleTitle(),
  };
}

function toEditorValues(article: AdminArticleDetailResponse): ArticleEditorValues {
  return {
    categorySlug: article.category?.slug ?? "",
    coverImageUrl: article.coverImageUrl ?? "",
    description: article.description,
    markdown: article.markdown,
    status: article.status,
    tagSlugs: article.tags.map((tag) => tag.slug),
    title: article.title,
  };
}

function toArticleMutationPayload(values: ArticleEditorValues): CreateAdminArticleRequest {
  return {
    categorySlug: values.categorySlug || null,
    coverImageUrl: normalizeNullableText(values.coverImageUrl),
    description: values.description.trim(),
    markdown: values.markdown,
    status: values.status,
    tagSlugs: values.tagSlugs,
    title: values.title,
  };
}

function getArticleEditorValidationMessage(values: ArticleEditorValues) {
  if (!values.title.trim()) {
    return "标题不能为空。";
  }

  if (!values.markdown.trim()) {
    return "Markdown 内容不能为空。";
  }

  if (values.status === "PUBLISHED" && !values.description.trim()) {
    return "发布文章前需要填写 SEO 描述。";
  }

  return null;
}

function requiresStatusConfirmation(
  previousStatus: AdminArticleStatus,
  nextStatus: AdminArticleStatus,
) {
  return previousStatus !== nextStatus && (nextStatus === "PUBLISHED" || nextStatus === "ARCHIVED");
}

function getStatusConfirmationText(nextStatus: AdminArticleStatus) {
  if (nextStatus === "PUBLISHED") {
    return "发布后读者可以访问这篇文章。确认保存？";
  }

  if (nextStatus === "ARCHIVED") {
    return "归档后这篇文章会从公开列表移除。确认保存？";
  }

  return "确认保存？";
}

function normalizeNullableText(value: string) {
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function createDefaultArticleTitle() {
  return `未命名文章 ${new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())}`;
}

export {
  createNewArticleEditorValues,
  getArticleEditorValidationMessage,
  getStatusConfirmationText,
  requiresStatusConfirmation,
  toArticleMutationPayload,
  toEditorValues,
};
