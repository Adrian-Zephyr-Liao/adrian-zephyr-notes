import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import type { ArticleDetailResponse, ArticleListResponse } from "@adrian-zephyr-notes/contracts";
import { ArticleNotFoundError } from "../application/article-not-found.error";
import { GetPublishedArticleBySlugUseCase } from "../application/get-published-article-by-slug.use-case";
import { ListPublishedArticlesUseCase } from "../application/list-published-articles.use-case";
import {
  toArticleDetailResponse,
  toArticleListResponse,
} from "../infrastructure/article-read-model.mapper";
import { ArticleListQueryDto } from "./dto/article-list-query.dto";

@Controller("api/articles")
class ArticlesController {
  constructor(
    private readonly listPublishedArticles: ListPublishedArticlesUseCase,
    private readonly getPublishedArticleBySlug: GetPublishedArticleBySlugUseCase,
  ) {}

  @Get()
  async list(@Query() query: ArticleListQueryDto): Promise<ArticleListResponse> {
    const result = await this.listPublishedArticles.execute({
      page: query.page,
      pageSize: query.pageSize,
      categorySlug: query.category,
      tagSlug: query.tag,
      search: query.q,
    });

    return toArticleListResponse(result);
  }

  @Get(":slug")
  async detail(@Param("slug") slug: string): Promise<ArticleDetailResponse> {
    try {
      const article = await this.getPublishedArticleBySlug.execute(slug);
      return toArticleDetailResponse(article);
    } catch (error) {
      if (error instanceof ArticleNotFoundError) {
        throw new NotFoundException({
          error: {
            code: "ARTICLE_NOT_FOUND",
            message: "Article not found",
          },
        });
      }

      throw error;
    }
  }
}

export { ArticlesController };
