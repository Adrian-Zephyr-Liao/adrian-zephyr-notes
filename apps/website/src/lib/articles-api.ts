import type {
  ArticleDetailResponse,
  ArticleListQuery,
  ArticleListResponse,
} from "@adrian-zephyr-notes/contracts";

const DEFAULT_API_BASE_URL = "http://localhost:3001";

async function getArticleBySlug(slug: string): Promise<ArticleDetailResponse | null> {
  const response = await fetch(`${getApiBaseUrl()}/api/articles/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch article ${slug}: ${response.status}`);
  }

  return (await response.json()) as ArticleDetailResponse;
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

  const response = await fetch(`${getApiBaseUrl()}/api/articles?${searchParams.toString()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch articles: ${response.status}`);
  }

  return (await response.json()) as ArticleListResponse;
}

function getApiBaseUrl() {
  return (
    process.env.BACKEND_API_BASE_URL ??
    process.env.ARTICLE_API_BASE_URL ??
    DEFAULT_API_BASE_URL
  ).replace(/\/$/, "");
}

export { getArticleBySlug, getArticles };
