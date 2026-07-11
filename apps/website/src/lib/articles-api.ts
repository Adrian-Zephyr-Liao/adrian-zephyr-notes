import type {
  ArticleCategoryDetailResponse,
  ArticleCategoryListResponse,
  ArticleDetailResponse,
  ArticleListQuery,
  ArticleListResponse,
  ArticleTagDetailResponse,
  ArticleTagListQuery,
  ArticleTagListResponse,
} from "@adrian-zephyr-notes/contracts";
import { cache } from "react";
import { getBackendApiBaseUrl } from "./backend-api";
import { isApiRequestError, requestJson } from "./api-client";

async function getArticleBySlug(slug: string): Promise<ArticleDetailResponse | null> {
  try {
    return await requestJson<ArticleDetailResponse>(
      `${getBackendApiBaseUrl()}/api/articles/${encodeURIComponent(slug)}`,
      {
        cache: "no-store",
      },
    );
  } catch (error) {
    if (isApiRequestError(error) && error.status === 404) {
      return null;
    }

    if (isApiRequestError(error)) {
      throw new Error(`Failed to fetch article ${slug}: ${error.status}`, {
        cause: error,
      });
    }

    throw error;
  }
}

const getArticleCategoryBySlug = cache(async function getArticleCategoryBySlug(
  slug: string,
): Promise<ArticleCategoryDetailResponse | null> {
  try {
    return await requestJson<ArticleCategoryDetailResponse>(
      `${getBackendApiBaseUrl()}/api/articles/categories/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
  } catch (error) {
    if (isApiRequestError(error) && error.status === 404) {
      return null;
    }

    if (isApiRequestError(error)) {
      throw new Error(`Failed to fetch article category ${slug}: ${error.status}`, {
        cause: error,
      });
    }

    throw error;
  }
});

async function getArticleCategories(): Promise<ArticleCategoryListResponse> {
  try {
    return await requestJson<ArticleCategoryListResponse>(
      `${getBackendApiBaseUrl()}/api/articles/categories`,
      { cache: "no-store" },
    );
  } catch (error) {
    if (isApiRequestError(error)) {
      throw new Error(`Failed to fetch article categories: ${error.status}`, { cause: error });
    }

    throw error;
  }
}

async function getArticleTags(query: ArticleTagListQuery = {}): Promise<ArticleTagListResponse> {
  const searchParams = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? 24),
  });
  return requestPublicTaxonomy<ArticleTagListResponse>(`tags?${searchParams.toString()}`);
}

const getArticleTagBySlug = cache(async function getArticleTagBySlug(
  slug: string,
): Promise<ArticleTagDetailResponse | null> {
  try {
    return await requestJson<ArticleTagDetailResponse>(
      `${getBackendApiBaseUrl()}/api/articles/tags/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
  } catch (error) {
    if (isApiRequestError(error) && error.status === 404) return null;
    if (isApiRequestError(error)) {
      throw new Error(`Failed to fetch article tag ${slug}: ${error.status}`, { cause: error });
    }
    throw error;
  }
});

async function requestPublicTaxonomy<TResponse>(path: string): Promise<TResponse> {
  try {
    return await requestJson<TResponse>(`${getBackendApiBaseUrl()}/api/articles/${path}`, {
      cache: "no-store",
    });
  } catch (error) {
    if (isApiRequestError(error)) {
      throw new Error(`Failed to fetch article ${path}: ${error.status}`, { cause: error });
    }
    throw error;
  }
}

async function getArticles(query: ArticleListQuery = {}): Promise<ArticleListResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(query.page ?? 1));
  searchParams.set("pageSize", String(query.pageSize ?? 12));

  if (query.category) {
    searchParams.set("category", query.category);
  }

  if (query.tag) {
    searchParams.set("tag", query.tag);
  }

  if (query.q) {
    searchParams.set("q", query.q);
  }

  try {
    return await requestJson<ArticleListResponse>(
      `${getBackendApiBaseUrl()}/api/articles?${searchParams.toString()}`,
      {
        cache: "no-store",
      },
    );
  } catch (error) {
    if (isApiRequestError(error)) {
      throw new Error(`Failed to fetch articles: ${error.status}`, {
        cause: error,
      });
    }

    throw error;
  }
}

export {
  getArticleBySlug,
  getArticleCategories,
  getArticleCategoryBySlug,
  getArticles,
  getArticleTagBySlug,
  getArticleTags,
};
