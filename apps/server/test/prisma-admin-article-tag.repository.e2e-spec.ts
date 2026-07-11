import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/database/prisma.service";
import { PrismaAdminArticleTagRepository } from "../src/articles/infrastructure/prisma-admin-article-tag.repository";

const databaseUrl = process.env.DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase("PrismaAdminArticleTagRepository (database)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("merges article links and editor draft slugs atomically", async () => {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const sourceSlug = `merge-source-${suffix}`;
    const targetSlug = `merge-target-${suffix}`;
    const userId = randomUUID();
    const articleId = randomUUID();
    const sourceId = randomUUID();
    const targetId = randomUUID();

    try {
      await prisma.user.create({
        data: {
          id: userId,
          githubId: `merge-test-${suffix}`,
          login: `merge-test-${suffix}`,
          profileUrl: "https://example.com/test",
        },
      });
      await prisma.article.create({
        data: {
          id: articleId,
          slug: suffix.slice(0, 8),
          title: "Merge integration test",
          description: "Temporary integration fixture",
          markdown: "# Fixture",
          status: "DRAFT",
          wordCount: 1,
          readingMinutes: 1,
        },
      });
      await prisma.articleTag.createMany({
        data: [
          { id: sourceId, name: `Source ${suffix}`, slug: sourceSlug },
          { id: targetId, name: `Target ${suffix}`, slug: targetSlug },
        ],
      });
      await prisma.articleTagLink.createMany({
        data: [
          { articleId, tagId: sourceId },
          { articleId, tagId: targetId },
        ],
      });
      await prisma.adminArticleEditorDraft.create({
        data: {
          ownerUserId: userId,
          scope: `new:${suffix}`,
          title: "Draft",
          description: "",
          markdown: "# Draft",
          tagSlugs: [sourceSlug, targetSlug, "other"],
        },
      });

      const repository = new PrismaAdminArticleTagRepository(prisma as unknown as PrismaService);
      await repository.merge(sourceId, targetId, {
        actorLogin: `merge-test-${suffix}`,
        actorUserId: userId,
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      });

      const [source, targetLinks, draft, audit] = await Promise.all([
        prisma.articleTag.findUnique({ where: { id: sourceId } }),
        prisma.articleTagLink.count({ where: { articleId, tagId: targetId } }),
        prisma.adminArticleEditorDraft.findUniqueOrThrow({
          where: { ownerUserId_scope: { ownerUserId: userId, scope: `new:${suffix}` } },
        }),
        prisma.adminOperationLog.findFirst({
          where: {
            action: "ARTICLE_TAG_MERGED",
            resourceId: targetId,
            resourceType: "article_tag",
          },
        }),
      ]);

      expect(source).toBeNull();
      expect(targetLinks).toBe(1);
      expect(draft.tagSlugs).toEqual([targetSlug, "other"]);
      expect(audit).toMatchObject({
        actorUserId: userId,
        resourceId: targetId,
      });
    } finally {
      await prisma.adminOperationLog.deleteMany({ where: { resourceId: targetId } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.article.deleteMany({ where: { id: articleId } });
      await prisma.articleTag.deleteMany({ where: { id: { in: [sourceId, targetId] } } });
    }
  });
});
