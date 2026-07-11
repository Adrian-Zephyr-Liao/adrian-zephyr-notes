import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import type {
  ArticleCategoryDetailResponse,
  ArticleCategoryListResponse,
  ArticleDetailResponse,
  ArticleListResponse,
  ArticleTagDetailResponse,
  ArticleTagListResponse,
} from "@adrian-zephyr-notes/contracts";
import { ArticleNotFoundError } from "../application/article-not-found.error";
import { GetPublishedArticleBySlugUseCase } from "../application/get-published-article-by-slug.use-case";
import {
  GetPublishedArticleCategoryUseCase,
  PublishedArticleCategoryNotFoundError,
} from "../application/get-published-article-category.use-case";
import { ListPublishedArticlesUseCase } from "../application/list-published-articles.use-case";
import { ListPublishedArticleCategoriesUseCase } from "../application/list-published-article-categories.use-case";
import {
  GetPublishedArticleTagUseCase,
  ListPublishedArticleTagsUseCase,
  PublishedArticleTagNotFoundError,
} from "../application/published-article-tags.use-cases";
import {
  toArticleDetailResponse,
  toArticleListResponse,
} from "../infrastructure/article-read-model.mapper";
import { ArticleListQueryDto, ArticleTagListQueryDto } from "./dto/article-list-query.dto";

@Controller("api/articles")
class ArticlesController {
  constructor(
    private readonly listPublishedArticles: ListPublishedArticlesUseCase,
    private readonly listPublishedArticleCategories: ListPublishedArticleCategoriesUseCase,
    private readonly getPublishedArticleCategory: GetPublishedArticleCategoryUseCase,
    private readonly listPublishedArticleTags: ListPublishedArticleTagsUseCase,
    private readonly getPublishedArticleTag: GetPublishedArticleTagUseCase,
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

  @Get("tags")
  async tags(@Query() query: ArticleTagListQueryDto): Promise<ArticleTagListResponse> {
    return this.listPublishedArticleTags.execute(query);
  }

  @Get("tags/:slug")
  async tag(@Param("slug") slug: string): Promise<ArticleTagDetailResponse> {
    try {
      return await this.getPublishedArticleTag.execute(slug);
    } catch (error) {
      if (error instanceof PublishedArticleTagNotFoundError) {
        throw new NotFoundException({
          error: { code: "ARTICLE_TAG_NOT_FOUND", message: "Article tag not found" },
        });
      }
      throw error;
    }
  }

  @Get("categories")
  async categories(): Promise<ArticleCategoryListResponse> {
    return { data: await this.listPublishedArticleCategories.execute() };
  }

  @Get("categories/:slug")
  async category(@Param("slug") slug: string): Promise<ArticleCategoryDetailResponse> {
    try {
      return await this.getPublishedArticleCategory.execute(slug);
    } catch (error) {
      if (error instanceof PublishedArticleCategoryNotFoundError) {
        throw new NotFoundException({
          error: {
            code: "ARTICLE_CATEGORY_NOT_FOUND",
            message: "Article category not found",
          },
        });
      }

      throw error;
    }
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
