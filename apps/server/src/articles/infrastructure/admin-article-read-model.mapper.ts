import type {
  AdminArticleDetailResponse,
  AdminArticleListItemResponse,
  AdminArticleListResponse,
  AdminArticleTaxonomyOptionsResponse,
} from "@adrian-zephyr-notes/contracts";
import type {
  AdminArticleDetail,
  AdminArticleListItem,
  AdminArticlesPage,
  AdminArticleTaxonomyOptions,
} from "../domain/admin-article.repository";

function toAdminArticleListResponse(page: AdminArticlesPage): AdminArticleListResponse {
  return {
    data: page.data.map(toAdminArticleListItemResponse),
    pagination: page.pagination,
  };
}

function toAdminArticleListItemResponse(
  article: AdminArticleListItem,
): AdminArticleListItemResponse {
  return {
    ...article,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
  };
}

function toAdminArticleDetailResponse(article: AdminArticleDetail): AdminArticleDetailResponse {
  return {
    ...toAdminArticleListItemResponse(article),
    markdown: article.markdown,
  };
}

function toAdminArticleTaxonomyOptionsResponse(
  options: AdminArticleTaxonomyOptions,
): AdminArticleTaxonomyOptionsResponse {
  return {
    categories: options.categories,
    tags: options.tags,
  };
}

export {
  toAdminArticleDetailResponse,
  toAdminArticleListItemResponse,
  toAdminArticleListResponse,
  toAdminArticleTaxonomyOptionsResponse,
};
