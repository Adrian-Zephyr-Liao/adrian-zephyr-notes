import type { ArticleStatus } from "./article-status";
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

type ArticleProps = {
  id: ArticleId;
  slug: ArticleSlug;
  title: string;
  description: string;
  markdown: string;
  status: ArticleStatus;
  category: ArticleCategory | null;
  tags: ArticleTag[];
  coverImageUrl: string | null;
  wordCount: number;
  readingMinutes: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateArticleProps = Omit<ArticleProps, "id" | "slug"> & {
  id: string;
  slug: string;
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
      tags: [...props.tags],
      publishedAt: cloneDateOrNull(props.publishedAt),
      createdAt: cloneDate(props.createdAt),
      updatedAt: cloneDate(props.updatedAt),
    });

    if (article.props.status === "PUBLISHED" && !article.props.publishedAt) {
      throw new Error("Published articles must have a publishedAt timestamp.");
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

function cloneDate(value: Date) {
  return new Date(value.getTime());
}

function cloneDateOrNull(value: Date | null) {
  return value ? cloneDate(value) : null;
}

export { Article };
export type { ArticleCategory, ArticleProps, ArticleTag, CreateArticleProps };
