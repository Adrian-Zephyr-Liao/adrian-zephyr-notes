import "reflect-metadata";
import { createRequire } from "node:module";
import type { INestApplication } from "@nestjs/common";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleRepository } from "../src/articles/domain/article.repository";

// Use the production decorators and emitted parameter metadata, not Vitest's TS transform.
const requireCompiled = createRequire(__filename);
const { ArticlesController } = requireCompiled(
  "../dist/articles/presentation/articles.controller.js",
) as typeof import("../src/articles/presentation/articles.controller");
const { ARTICLE_REPOSITORY } = requireCompiled(
  "../dist/articles/domain/article.repository.js",
) as typeof import("../src/articles/domain/article.repository");
const { ListPublishedArticlesUseCase } = requireCompiled(
  "../dist/articles/application/list-published-articles.use-case.js",
) as typeof import("../src/articles/application/list-published-articles.use-case");
const { ListPublishedArticleCategoriesUseCase } = requireCompiled(
  "../dist/articles/application/list-published-article-categories.use-case.js",
) as typeof import("../src/articles/application/list-published-article-categories.use-case");
const { GetPublishedArticleCategoryUseCase } = requireCompiled(
  "../dist/articles/application/get-published-article-category.use-case.js",
) as typeof import("../src/articles/application/get-published-article-category.use-case");
const { GetPublishedArticleTagUseCase, ListPublishedArticleTagsUseCase } = requireCompiled(
  "../dist/articles/application/published-article-tags.use-cases.js",
) as typeof import("../src/articles/application/published-article-tags.use-cases");
const { GetPublishedArticleBySlugUseCase } = requireCompiled(
  "../dist/articles/application/get-published-article-by-slug.use-case.js",
) as typeof import("../src/articles/application/get-published-article-by-slug.use-case");

describe("public article pagination through compiled HTTP validation", () => {
  let app: INestApplication;
  const emptyPage = {
    data: [],
    pagination: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
  };
  const repository = {
    findPublishedCategoryBySlug: vi.fn(),
    findPublishedBySlug: vi.fn(),
    findPublishedTagBySlug: vi.fn(),
    listPublishedCategories: vi.fn(),
    listPublished: vi.fn().mockResolvedValue(emptyPage),
    listPublishedTags: vi.fn().mockResolvedValue(emptyPage),
  } satisfies ArticleRepository;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ArticlesController],
      providers: [
        { provide: ARTICLE_REPOSITORY, useValue: repository },
        ListPublishedArticlesUseCase,
        ListPublishedArticleTagsUseCase,
        ...[
          ListPublishedArticleCategoriesUseCase,
          GetPublishedArticleCategoryUseCase,
          GetPublishedArticleTagUseCase,
          GetPublishedArticleBySlugUseCase,
        ].map((provide) => ({ provide, useValue: { execute: vi.fn() } })),
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, "127.0.0.1");
  });

  beforeEach(() => vi.clearAllMocks());

  afterAll(async () => {
    await app?.close();
  });

  it.each(["/api/articles", "/api/articles/tags"])(
    "%s rejects out-of-range and unsafe pages before querying the repository",
    async (path) => {
      for (const page of ["10001", "2147483648", "9007199254740992", "1e100"]) {
        await request(app.getHttpServer()).get(path).query({ page }).expect(400);
      }
      expect(repository.listPublished).not.toHaveBeenCalled();
      expect(repository.listPublishedTags).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["/api/articles", "listPublished", 10],
    ["/api/articles/tags", "listPublishedTags", 24],
  ] as const)(
    "%s preserves defaults and accepts the last supported page",
    async (path, method, pageSize) => {
      await request(app.getHttpServer()).get(path).expect(200);
      expect(repository[method]).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, pageSize }),
      );

      await request(app.getHttpServer())
        .get(path)
        .query({ page: "10000", pageSize: "50" })
        .expect(200);
      expect(repository[method]).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 10_000, pageSize: 50 }),
      );
    },
  );
});
