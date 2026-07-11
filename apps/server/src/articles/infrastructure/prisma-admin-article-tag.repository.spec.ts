import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../../database/prisma.service";
import { PrismaAdminArticleTagRepository } from "./prisma-admin-article-tag.repository";

describe("PrismaAdminArticleTagRepository", () => {
  const audit = {
    actorLogin: "admin",
    actorUserId: "user-1",
    ipAddress: "127.0.0.1",
    userAgent: "vitest",
  };

  it("moves source links, removes them explicitly, and deletes the source tag", async () => {
    const operations: string[] = [];
    const tx = {
      articleTag: {
        delete: vi.fn(async () => operations.push("delete-source")),
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
          where.id === "source" || where.id === "target" ? { id: where.id, slug: where.id } : null,
        ),
        findUniqueOrThrow: vi.fn(async () => {
          operations.push("load-target");
          return tagRecord({ articleCount: 3, id: "target" });
        }),
      },
      articleTagLink: {
        createMany: vi.fn(async () => operations.push("copy-links")),
        deleteMany: vi.fn(async () => operations.push("delete-source-links")),
        findMany: vi.fn(async () => [{ articleId: "article-1" }, { articleId: "article-2" }]),
      },
      adminArticleEditorDraft: {
        findMany: vi.fn(async () => [{ id: "draft-1", tagSlugs: ["source", "target", "other"] }]),
        update: vi.fn(async () => operations.push("update-draft")),
      },
      adminOperationLog: {
        create: vi.fn(async () => operations.push("write-audit")),
      },
    };
    const repository = new PrismaAdminArticleTagRepository(
      createPrismaDouble({
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      }),
    );

    await expect(repository.merge("source", "target", audit)).resolves.toMatchObject({
      articleCount: 3,
      id: "target",
    });
    expect(tx.articleTagLink.createMany).toHaveBeenCalledWith({
      data: [
        { articleId: "article-1", tagId: "target" },
        { articleId: "article-2", tagId: "target" },
      ],
      skipDuplicates: true,
    });
    expect(tx.articleTagLink.deleteMany).toHaveBeenCalledWith({ where: { tagId: "source" } });
    expect(tx.adminArticleEditorDraft.update).toHaveBeenCalledWith({
      where: { id: "draft-1" },
      data: { tagSlugs: ["target", "other"] },
    });
    expect(tx.adminOperationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "ARTICLE_TAG_MERGED",
        actorLogin: "admin",
        actorUserId: "user-1",
        resourceId: "target",
        resourceType: "article_tag",
      }),
    });
    expect(operations).toEqual([
      "copy-links",
      "delete-source-links",
      "update-draft",
      "delete-source",
      "load-target",
      "write-audit",
    ]);
  });

  it("blocks deleting a tag referenced by an editor draft", async () => {
    const tx = {
      adminArticleEditorDraft: { count: vi.fn().mockResolvedValue(1) },
      articleTag: {
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ _count: { articles: 0 }, slug: "tag" }),
      },
    };
    const repository = new PrismaAdminArticleTagRepository(
      createPrismaDouble({
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      }),
    );

    await expect(repository.delete("tag-1")).resolves.toBe("IN_USE");
    expect(tx.articleTag.delete).not.toHaveBeenCalled();
  });

  it("maps a concurrent foreign-key conflict to IN_USE", async () => {
    const tx = {
      adminArticleEditorDraft: { count: vi.fn().mockResolvedValue(0) },
      articleTag: {
        delete: vi.fn().mockRejectedValue(prismaError("P2003")),
        findUnique: vi.fn().mockResolvedValue({ _count: { articles: 0 }, slug: "tag" }),
      },
    };
    const repository = new PrismaAdminArticleTagRepository(
      createPrismaDouble({
        $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      }),
    );

    await expect(repository.delete("tag-1")).resolves.toBe("IN_USE");
  });
});

function createPrismaDouble(value: object) {
  return value as unknown as PrismaService;
}

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError("constraint failed", {
    clientVersion: "test",
    code,
  });
}

function tagRecord({ articleCount, id }: { articleCount: number; id: string }) {
  return {
    _count: { articles: articleCount },
    createdAt: new Date("2026-07-11T00:00:00.000Z"),
    id,
    name: "Target",
    slug: "target",
    updatedAt: new Date("2026-07-11T00:00:00.000Z"),
  };
}
