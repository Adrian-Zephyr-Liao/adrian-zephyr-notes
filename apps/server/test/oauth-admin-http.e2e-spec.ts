import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { Controller, Get, UseGuards, ValidationPipe, type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import type { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaAuthSessionRepository } from "../src/auth/infrastructure/prisma-auth-session.repository";
import { hashCredential } from "../src/oauth/application/oauth.service";
import type { ArticleImageStoragePutInput } from "../src/articles/domain/article-image-storage";

const databaseUrl = process.env.ASSISTANT_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)(
  "Full administrator OAuth through compiled HTTP and PostgreSQL",
  () => {
    const userId = randomUUID();
    const otherId = randomUUID();
    const articleId = randomUUID();
    const commentId = randomUUID();
    const messageId = randomUUID();
    const announcementId = randomUUID();
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const login = `oauth-admin-${suffix}`;
    const createdArticles: string[] = [];
    const createdCategories: string[] = [];
    const createdTags: string[] = [];
    const storedImages: ArticleImageStoragePutInput[] = [];
    const settingKeys = ["home", "navigation-items", "social-links"];
    let settingsBefore: Array<{ key: string; value: Prisma.JsonValue }> = [];
    let app: INestApplication;
    let prisma: PrismaService;
    let origin: string;
    let cookie: string;
    let read: string;
    let write: string;
    let full: string;
    let legacy: string;
    let probeCalls = 0;

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", databaseUrl);
      vi.stubEnv("ADMIN_GITHUB_LOGINS", login);
      vi.stubEnv("ADMIN_FRONTEND_ORIGIN", "http://localhost:3000");
      vi.stubEnv("ASSISTANT_ENABLED", "false");
      const loadCompiled = createRequire(__filename);
      const { AppModule } = loadCompiled("../dist/app.module.js");
      const { AuthModule } = loadCompiled("../dist/auth/auth.module.js");
      const { OAuthModule } = loadCompiled("../dist/oauth/oauth.module.js");
      const { AdminApiAccessGuard } = loadCompiled(
        "../dist/oauth/presentation/admin-api-access.guard.js",
      );
      const { ARTICLE_IMAGE_STORAGE } = loadCompiled(
        "../dist/articles/domain/article-image-storage.js",
      );
      class UnscopedController {
        probe() {
          probeCalls++;
          return {};
        }
      }
      Controller("api/admin/unscoped-probe")(UnscopedController);
      UseGuards(AdminApiAccessGuard)(UnscopedController);
      Get()(
        UnscopedController.prototype,
        "probe",
        Object.getOwnPropertyDescriptor(UnscopedController.prototype, "probe")!,
      );
      const module = await Test.createTestingModule({
        imports: [AppModule, AuthModule, OAuthModule],
        controllers: [UnscopedController],
      })
        .overrideProvider(ARTICLE_IMAGE_STORAGE)
        .useValue({
          put: async (input: ArticleImageStoragePutInput) => {
            storedImages.push(input);
            return { key: input.key, url: `https://images.example.test/${input.key}` };
          },
        })
        .compile();
      app = module.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
      await app.listen(0, "127.0.0.1");
      origin = await app.getUrl();
      prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
      settingsBefore = await prisma.siteSetting.findMany({
        where: { key: { in: settingKeys } },
        select: { key: true, value: true },
      });
      await prisma.user.createMany({
        data: [
          { id: userId, githubId: login, login, profileUrl: "https://example.test/admin" },
          {
            id: otherId,
            githubId: `${login}-other`,
            login: `${login}-other`,
            profileUrl: "https://example.test/other",
          },
        ],
      });
      cookie = `azn_session=${(await new PrismaAuthSessionRepository(prisma).createSession(userId)).token}`;
      read = await token("admin:read");
      write = await token("admin:write");
      full = await token("admin:read admin:write");
      legacy = await token("articles:read articles:write");
      await prisma.article.create({
        data: {
          id: articleId,
          slug: `oauth-${suffix}`,
          title: "OAuth scope fixture",
          description: "Fixture",
          markdown: "# Fixture",
          status: "DRAFT",
          wordCount: 1,
          readingMinutes: 1,
        },
      });
      await prisma.articleComment.create({
        data: {
          id: commentId,
          articleId,
          authorId: userId,
          body: "Scope moderation fixture",
          status: "VISIBLE",
        },
      });
      await prisma.guestbookMessage.create({
        data: {
          id: messageId,
          authorUserId: userId,
          body: "Scope guestbook fixture",
          status: "VISIBLE",
        },
      });
      await prisma.siteAnnouncement.create({
        data: {
          id: announcementId,
          key: `oauth-${suffix}`,
          title: "Scope announcement",
          icon: "terminal",
          iconClassName: "",
          process: "fixture",
          status: "ready",
          command: "fixture",
          output: "fixture",
        },
      });
    }, 30000);

    afterAll(async () => {
      try {
        if (prisma) {
          await prisma.adminOperationLog.deleteMany({
            where: { actorUserId: { in: [userId, otherId] } },
          });
          await prisma.article.deleteMany({
            where: { id: { in: [articleId, ...createdArticles] } },
          });
          await prisma.articleCategory.deleteMany({ where: { id: { in: createdCategories } } });
          await prisma.articleTag.deleteMany({ where: { id: { in: createdTags } } });
          await prisma.siteAnnouncement.deleteMany({ where: { id: announcementId } });
          await prisma.guestbookMessage.deleteMany({ where: { id: messageId } });
          await prisma.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
          await prisma.siteSetting.deleteMany({ where: { key: { in: settingKeys } } });
          for (const row of settingsBefore)
            await prisma.siteSetting.create({
              data: { key: row.key, value: row.value as Prisma.InputJsonValue },
            });
        }
      } finally {
        await app?.close();
        await prisma?.$disconnect();
        vi.unstubAllEnvs();
      }
    });

    it("keeps identity and browser authorization boundaries while failing closed for undeclared routes", async () => {
      expect(await (await http("GET", "/api/admin/auth/me", null)).json()).toEqual({ user: null });
      expect(
        await (await http("GET", "/api/admin/auth/me", null, undefined, { Cookie: cookie })).json(),
      ).toMatchObject({ user: { id: userId } });
      for (const credential of [read, write, full, legacy]) {
        expect(await (await http("GET", "/api/admin/auth/me", credential)).json()).toMatchObject({
          user: { id: userId, role: "ADMIN" },
        });
      }
      expect(
        (await http("GET", "/api/admin/auth/me", "invalid", undefined, { Cookie: cookie })).status,
      ).toBe(401);
      expect((await http("GET", "/api/admin/unscoped-probe", full)).status).toBe(403);
      expect(probeCalls).toBe(0);
      expect((await http("GET", "/api/oauth/consent?user_code=ABCD-EFGH", full)).status).toBe(401);
      expect(
        (
          await http(
            "POST",
            "/api/oauth/authorize",
            full,
            { user_code: "ABCD-EFGH", decision: "allow" },
            { Origin: "http://localhost:3000" },
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await http(
            "POST",
            "/api/oauth/authorize",
            null,
            { user_code: "ABCD-EFGH", decision: "allow" },
            { Cookie: cookie, Origin: "https://evil.example" },
          )
        ).status,
      ).toBe(403);
    });

    it("grants full read access without admitting writes or broadening existing article tokens", async () => {
      const paths = [
        "/api/admin/articles",
        `/api/admin/articles/${articleId}`,
        "/api/admin/articles/taxonomies",
        "/api/admin/article-categories",
        "/api/admin/article-tags",
        "/api/admin/article-drafts/current",
        "/api/admin/comments",
        "/api/admin/guestbook/messages",
        "/api/admin/site-config",
        "/api/admin/audit/logs",
        "/api/admin/assistant/capabilities",
      ];
      for (const path of paths) {
        expect((await http("GET", path, read)).status, path).toBe(200);
        expect((await http("GET", path, write)).status, path).toBe(403);
        expect((await http("GET", path, null, undefined, { Cookie: cookie })).status, path).toBe(
          200,
        );
        if (!path.startsWith("/api/admin/articles"))
          expect((await http("GET", path, legacy)).status, path).toBe(403);
      }
      for (const [method, path, body] of [
        ["DELETE", `/api/admin/articles/${articleId}`, undefined],
        [
          "POST",
          "/api/admin/article-categories",
          { name: "Forbidden", slug: `forbidden-${suffix}` },
        ],
        ["PATCH", `/api/admin/comments/${commentId}`, { status: "HIDDEN" }],
        ["PATCH", `/api/admin/guestbook/messages/${messageId}`, { status: "HIDDEN" }],
        ["PUT", "/api/admin/site-config/settings", {}],
      ] as Array<[string, string, unknown]>) {
        for (const credential of [read, legacy])
          expect((await http(method, path, credential, body)).status, path).toBe(403);
      }
      expect(
        await prisma.articleComment.findUniqueOrThrow({ where: { id: commentId } }),
      ).toMatchObject({ status: "VISIBLE", moderationVersion: 0 });
      expect(
        await prisma.guestbookMessage.findUniqueOrThrow({ where: { id: messageId } }),
      ).toMatchObject({ status: "VISIBLE" });
      expect(await prisma.article.count({ where: { id: articleId } })).toBe(1);
    });

    it("returns JSON null for a missing cloud draft and JSON content for a saved draft", async () => {
      const path = `/api/admin/article-drafts/current?articleId=${articleId}`;
      const empty = await http("GET", path, read);
      expect(empty.status).toBe(200);
      expect(empty.headers.get("content-type")).toContain("application/json");
      expect(await empty.text()).toBe("null");
      const emptyCookie = await http("GET", path, null, undefined, { Cookie: cookie });
      expect(emptyCookie.headers.get("content-type")).toContain("application/json");
      expect(await emptyCookie.json()).toBeNull();

      const draft = await json("PUT", "/api/admin/article-drafts/current", {
        articleId,
        clientSavedAt: new Date().toISOString(),
        values: {
          title: "Cloud draft response fixture",
          description: "",
          markdown: "# Cloud draft",
          status: "DRAFT",
          categorySlug: "",
          tagSlugs: [],
          coverImageUrl: "",
          origin: "ORIGINAL",
          sourceAuthor: "",
          sourceName: "",
          sourceUrl: "",
        },
      });
      try {
        const saved = await http("GET", path, read);
        expect(saved.status).toBe(200);
        expect(saved.headers.get("content-type")).toContain("application/json");
        expect(await saved.json()).toEqual(draft);
      } finally {
        expect((await http("DELETE", path, write)).status).toBe(204);
      }
    });

    it("uses existing taxonomy, draft, article, moderation and settings operations with the authenticated actor", async () => {
      const category = await json(
        "POST",
        "/api/admin/article-categories",
        { name: `OAuth ${suffix}`, slug: `oauth-${suffix}` },
        201,
      );
      createdCategories.push(category.id as string);
      expect(
        await json("PATCH", `/api/admin/article-categories/${category.id}`, {
          description: "Updated",
        }),
      ).toMatchObject({ description: "Updated" });
      const source = await json(
        "POST",
        "/api/admin/article-tags",
        { name: `Source ${suffix}`, slug: `source-${suffix}` },
        201,
      );
      const target = await json(
        "POST",
        "/api/admin/article-tags",
        { name: `Target ${suffix}`, slug: `target-${suffix}` },
        201,
      );
      createdTags.push(source.id as string, target.id as string);
      await json("PATCH", `/api/admin/article-tags/${source.id}`, { name: "Updated source" });
      const article = await json(
        "POST",
        "/api/admin/articles",
        {
          title: "OAuth admin draft",
          description: "",
          markdown: "# Saved",
          categorySlug: category.slug,
          tagSlugs: [source.slug],
        },
        201,
      );
      createdArticles.push(article.id as string);
      const draft = await json("PUT", "/api/admin/article-drafts/current", {
        articleId: article.id,
        ownerUserId: otherId,
        clientSavedAt: new Date().toISOString(),
        values: {
          title: "Editor draft",
          description: "",
          markdown: "# Editor draft",
          status: "DRAFT",
          categorySlug: category.slug,
          tagSlugs: [source.slug],
          coverImageUrl: "",
          origin: "ORIGINAL",
          sourceAuthor: "",
          sourceName: "",
          sourceUrl: "",
        },
      });
      expect(draft.articleId).toBe(article.id);
      expect(
        await prisma.adminArticleEditorDraft.findFirstOrThrow({
          where: { articleId: article.id as string },
        }),
      ).toMatchObject({ ownerUserId: userId });
      await json(
        "POST",
        `/api/admin/article-tags/${source.id}/merge`,
        { targetTagId: target.id },
        201,
      );
      expect(await prisma.articleTag.count({ where: { id: source.id as string } })).toBe(0);
      expect(
        await prisma.adminArticleEditorDraft.findFirstOrThrow({
          where: { articleId: article.id as string },
        }),
      ).toMatchObject({ tagSlugs: [target.slug] });
      expect(
        (await http("DELETE", `/api/admin/article-drafts/current?articleId=${article.id}`, write))
          .status,
      ).toBe(204);
      expect((await http("DELETE", `/api/admin/articles/${article.id}`, write)).status).toBe(204);
      expect((await http("DELETE", `/api/admin/article-tags/${target.id}`, write)).status).toBe(
        204,
      );
      expect(
        (await http("DELETE", `/api/admin/article-categories/${category.id}`, write)).status,
      ).toBe(204);
      expect(
        await json("PATCH", `/api/admin/comments/${commentId}`, { status: "HIDDEN" }),
      ).toMatchObject({ status: "HIDDEN" });
      expect(
        await json("PATCH", `/api/admin/guestbook/messages/${messageId}`, {
          isPinned: true,
          status: "HIDDEN",
        }),
      ).toMatchObject({ isPinned: true, status: "HIDDEN" });
      expect(
        await json("PATCH", `/api/admin/site-config/announcements/${announcementId}`, {
          title: "Updated scope announcement",
        }),
      ).toMatchObject({ title: "Updated scope announcement" });
      const config = await (await http("GET", "/api/admin/site-config", read)).json();
      const settings = {
        home: { ...config.home, title: "OAuth local regression" },
        navigationItems: config.navigationItems,
        socialLinks: config.socialLinks,
      };
      expect(await json("PUT", "/api/admin/site-config/settings", settings)).toMatchObject({
        home: { title: "OAuth local regression" },
      });
      const audit = await prisma.adminOperationLog.findMany({ where: { actorUserId: userId } });
      expect(audit.map((item) => item.action)).toEqual(
        expect.arrayContaining([
          "ARTICLE_DELETED",
          "ARTICLE_CATEGORY_CREATED",
          "ARTICLE_TAG_MERGED",
          "COMMENT_STATUS_UPDATED",
          "GUESTBOOK_MESSAGE_UPDATED",
          "SITE_SETTINGS_UPDATED",
          "SITE_ANNOUNCEMENT_UPDATED",
        ]),
      );
      expect(audit.every((item) => item.actorLogin === login)).toBe(true);
    });

    it("authorizes multipart images before storage and keeps existing format, MIME and size checks", async () => {
      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6iHcAAAAASUVORK5CYII=",
        "base64",
      );
      for (const credential of [read, legacy])
        expect((await image(credential, png, "image/png")).status).toBe(403);
      expect(storedImages).toHaveLength(0);
      expect((await image(write, Buffer.from("not an image"), "image/png")).status).toBe(400);
      expect((await image(write, png, "image/jpeg")).status).toBe(400);
      expect((await image(write, Buffer.alloc(10 * 1024 * 1024 + 1), "image/png")).status).toBe(
        413,
      );
      expect(storedImages).toHaveLength(0);
      const response = await image(write, png, "image/png");
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({
        mimeType: "image/png",
        size: png.length,
        originalName: "picture.png",
      });
      expect(storedImages).toHaveLength(1);
      expect(storedImages[0].body.equals(png)).toBe(true);
      expect((await image(null, png, "image/png", { Cookie: cookie })).status).toBe(201);
      const revoked = await token("admin:read admin:write");
      await prisma.oAuthAccessToken.deleteMany({ where: { tokenHash: hashCredential(revoked) } });
      expect((await image(revoked, png, "image/png", { Cookie: cookie })).status).toBe(401);
      expect(storedImages).toHaveLength(2);
    });

    async function token(scope: string) {
      const value = randomBytes(32).toString("base64url");
      await prisma.oAuthAccessToken.create({
        data: {
          tokenHash: hashCredential(value),
          userId,
          clientId: "azn-cli",
          scope,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      return value;
    }
    function http(
      method: string,
      path: string,
      credential: string | null = full,
      body?: unknown,
      extraHeaders: Record<string, string> = {},
    ) {
      const headers = new Headers(extraHeaders);
      if (credential !== null) headers.set("Authorization", `Bearer ${credential}`);
      if (body !== undefined) headers.set("Content-Type", "application/json");
      return fetch(new URL(path, origin), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
    }
    async function json(method: string, path: string, body: unknown, status = 200) {
      const response = await http(method, path, write, body);
      expect(response.status, await response.clone().text()).toBe(status);
      return (await response.json()) as Record<string, any>;
    }
    function image(
      credential: string | null,
      bytes: Buffer,
      mimeType: string,
      headers: Record<string, string> = {},
    ) {
      const form = new FormData();
      form.append("file", new Blob([Uint8Array.from(bytes)], { type: mimeType }), "picture.png");
      if (credential !== null) headers.Authorization = `Bearer ${credential}`;
      return fetch(new URL("/api/admin/articles/images", origin), {
        method: "POST",
        headers,
        body: form,
        signal: AbortSignal.timeout(10000),
      });
    }
  },
);
