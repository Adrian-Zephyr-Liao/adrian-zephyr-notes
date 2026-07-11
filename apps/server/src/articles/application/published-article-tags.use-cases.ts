import { Inject, Injectable } from "@nestjs/common";
import { ARTICLE_REPOSITORY, type ArticleRepository } from "../domain/article.repository";

class PublishedArticleTagNotFoundError extends Error {}

@Injectable()
class GetPublishedArticleTagUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly repository: ArticleRepository,
  ) {}

  async execute(slug: string, now = new Date()) {
    const normalizedSlug = slug.trim();
    const tag = normalizedSlug
      ? await this.repository.findPublishedTagBySlug(normalizedSlug, now)
      : null;

    if (!tag) throw new PublishedArticleTagNotFoundError();
    return tag;
  }
}

@Injectable()
class ListPublishedArticleTagsUseCase {
  constructor(
    @Inject(ARTICLE_REPOSITORY)
    private readonly repository: ArticleRepository,
  ) {}

  execute(input: { now?: Date; page?: number; pageSize?: number } = {}) {
    return this.repository.listPublishedTags({
      now: input.now ?? new Date(),
      page: positive(input.page, 1),
      pageSize: Math.min(positive(input.pageSize, 24), 50),
    });
  }
}

function positive(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback;
}

export {
  GetPublishedArticleTagUseCase,
  ListPublishedArticleTagsUseCase,
  PublishedArticleTagNotFoundError,
};
