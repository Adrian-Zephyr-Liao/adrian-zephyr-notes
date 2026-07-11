import type { ArticleStatus } from "./article-status";
import type { ArticleAiSummary } from "./article-ai-summary.entity";
import { ArticleId } from "./value-objects/article-id";
import { ArticleSlug } from "./value-objects/article-slug";

type ArticleCategory = {
  slug: string;
  name: string;
};

type ArticleTag = {
  slug: string;
  name: string;
};

type ArticleOrigin = "ORIGINAL" | "REPOSTED";

type ArticleSource = {
  author: string | null;
  name: string;
  url: string;
};

type ArticleProps = {
  id: ArticleId;
  slug: ArticleSlug;
  title: string;
  description: string;
  markdown: string;
  origin: ArticleOrigin;
  source: ArticleSource | null;
  status: ArticleStatus;
  category: ArticleCategory | null;
  tags: ArticleTag[];
  coverImageUrl: string | null;
  wordCount: number;
  readingMinutes: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  aiSummary: ArticleAiSummary | null;
};

type CreateArticleProps = Omit<ArticleProps, "id" | "slug" | "aiSummary"> & {
  id: string;
  slug: string;
  aiSummary?: ArticleAiSummary | null;
};

class Article {
  private constructor(private readonly props: ArticleProps) {}

  static create(props: CreateArticleProps) {
    const article = new Article({
      ...props,
      id: ArticleId.create(props.id),
      slug: ArticleSlug.create(props.slug),
      title: requireText(props.title, "Article title"),
      description: requireText(props.description, "Article description"),
      markdown: requireText(props.markdown, "Article markdown"),
      source: props.source
        ? {
            author: props.source.author?.trim() || null,
            name: requireText(props.source.name, "Article source name"),
            url: requireHttpUrl(props.source.url, "Article source URL"),
          }
        : null,
      tags: [...props.tags],
      publishedAt: cloneDateOrNull(props.publishedAt),
      createdAt: cloneDate(props.createdAt),
      updatedAt: cloneDate(props.updatedAt),
      aiSummary: props.aiSummary ?? null,
    });

    if (article.props.status === "PUBLISHED" && !article.props.publishedAt) {
      throw new Error("Published articles must have a publishedAt timestamp.");
    }

    if (article.props.origin === "ORIGINAL" && article.props.source) {
      throw new Error("Original articles cannot include repost attribution.");
    }

    if (article.props.origin === "REPOSTED" && !article.props.source) {
      throw new Error("Reposted articles require source attribution.");
    }

    if (article.props.wordCount < 0 || article.props.readingMinutes < 0) {
      throw new Error("Article reading metrics cannot be negative.");
    }

    return article;
  }

  get id() {
    return this.props.id.toString();
  }

  get slug() {
    return this.props.slug.toString();
  }

  get title() {
    return this.props.title;
  }

  get description() {
    return this.props.description;
  }

  get markdown() {
    return this.props.markdown;
  }

  get origin() {
    return this.props.origin;
  }

  get source() {
    return this.props.source ? { ...this.props.source } : null;
  }

  get category() {
    return this.props.category;
  }

  get tags() {
    return [...this.props.tags];
  }

  get coverImageUrl() {
    return this.props.coverImageUrl;
  }

  get wordCount() {
    return this.props.wordCount;
  }

  get readingMinutes() {
    return this.props.readingMinutes;
  }

  get publishedAt() {
    return cloneDateOrNull(this.props.publishedAt);
  }

  get updatedAt() {
    return cloneDate(this.props.updatedAt);
  }

  get aiSummary() {
    return this.props.aiSummary;
  }

  isPubliclyVisible(now: Date) {
    return (
      this.props.status === "PUBLISHED" &&
      this.props.publishedAt !== null &&
      this.props.publishedAt.getTime() <= now.getTime()
    );
  }
}

function requireText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function requireHttpUrl(value: string, fieldName: string) {
  const normalized = requireText(value, fieldName);

  try {
    const url = new URL(normalized);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new Error(`${fieldName} must be a valid HTTP(S) URL.`);
  }

  return normalized;
}

function cloneDate(value: Date) {
  return new Date(value.getTime());
}

function cloneDateOrNull(value: Date | null) {
  return value ? cloneDate(value) : null;
}

export { Article };
export type {
  ArticleCategory,
  ArticleOrigin,
  ArticleProps,
  ArticleSource,
  ArticleTag,
  CreateArticleProps,
};
