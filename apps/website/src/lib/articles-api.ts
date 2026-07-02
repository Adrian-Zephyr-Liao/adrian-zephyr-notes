import type {
  ArticleDetailResponse,
  ArticleListQuery,
  ArticleListResponse,
} from "@adrian-zephyr-notes/contracts";
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

export { getArticleBySlug, getArticles };
