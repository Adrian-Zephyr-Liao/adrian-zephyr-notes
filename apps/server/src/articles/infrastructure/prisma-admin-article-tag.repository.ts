import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  AdminArticleTagConflictError,
  type AdminArticleTagRepository,
  type AdminArticleTagMergeAudit,
  type AdminArticleTagWriteInput,
} from "../domain/admin-article-tag.repository";

const tagSelect = {
  _count: { select: { articles: true } },
  createdAt: true,
  id: true,
  name: true,
  slug: true,
  updatedAt: true,
} satisfies Prisma.ArticleTagSelect;

@Injectable()
class PrismaAdminArticleTagRepository implements AdminArticleTagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: AdminArticleTagWriteInput) {
    try {
      return toTag(await this.prisma.articleTag.create({ data: input, select: tagSelect }));
    } catch (error) {
      if (unique(error)) throw new AdminArticleTagConflictError();
      throw error;
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tag = await tx.articleTag.findUnique({
          where: { id },
          select: { _count: { select: { articles: true } }, slug: true },
        });
        if (!tag) return "NOT_FOUND" as const;
        const draftCount = await tx.adminArticleEditorDraft.count({
          where: { tagSlugs: { has: tag.slug } },
        });
        if (tag._count.articles > 0 || draftCount > 0) return "IN_USE" as const;
        await tx.articleTag.delete({ where: { id } });
        return "DELETED" as const;
      });
    } catch (error) {
      if (missing(error)) return "NOT_FOUND" as const;
      if (foreignKey(error)) return "IN_USE" as const;
      throw error;
    }
  }

  async list(input: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.ArticleTagWhereInput = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {};
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.articleTag.findMany({
        orderBy: [{ name: "asc" }, { slug: "asc" }],
        select: tagSelect,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where,
      }),
      this.prisma.articleTag.count({ where }),
    ]);
    return {
      data: records.map(toTag),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async merge(sourceId: string, targetId: string, audit: AdminArticleTagMergeAudit) {
    return this.prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.articleTag.findUnique({ where: { id: sourceId }, select: { id: true, slug: true } }),
        tx.articleTag.findUnique({ where: { id: targetId }, select: { id: true, slug: true } }),
      ]);
      if (!source || !target) return null;
      const links = await tx.articleTagLink.findMany({
        where: { tagId: sourceId },
        select: { articleId: true },
      });
      if (links.length)
        await tx.articleTagLink.createMany({
          data: links.map((link) => ({ articleId: link.articleId, tagId: targetId })),
          skipDuplicates: true,
        });
      await tx.articleTagLink.deleteMany({ where: { tagId: sourceId } });
      await replaceDraftTagSlug(tx, source.slug, target.slug);
      await tx.articleTag.delete({ where: { id: sourceId } });
      const merged = toTag(
        await tx.articleTag.findUniqueOrThrow({ where: { id: targetId }, select: tagSelect }),
      );
      await tx.adminOperationLog.create({
        data: {
          action: "ARTICLE_TAG_MERGED",
          actorLogin: audit.actorLogin,
          actorUserId: audit.actorUserId,
          ipAddress: audit.ipAddress,
          metadata: {
            sourceTagId: source.id,
            sourceSlug: source.slug,
            targetTagId: target.id,
            targetSlug: target.slug,
          },
          resourceId: target.id,
          resourceType: "article_tag",
          summary: "合并文章标签",
          userAgent: audit.userAgent,
        },
      });
      return merged;
    });
  }

  async update(id: string, input: Partial<AdminArticleTagWriteInput>) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.articleTag.findUnique({ where: { id }, select: { slug: true } });
        if (!existing) return null;
        const updated = await tx.articleTag.update({
          where: { id },
          data: input,
          select: tagSelect,
        });
        if (updated.slug !== existing.slug) {
          await replaceDraftTagSlug(tx, existing.slug, updated.slug);
        }
        return toTag(updated);
      });
    } catch (error) {
      if (missing(error)) return null;
      if (unique(error)) throw new AdminArticleTagConflictError();
      throw error;
    }
  }
}

async function replaceDraftTagSlug(
  tx: Prisma.TransactionClient,
  sourceSlug: string,
  targetSlug: string,
) {
  const drafts = await tx.adminArticleEditorDraft.findMany({
    where: { tagSlugs: { has: sourceSlug } },
    select: { id: true, tagSlugs: true },
  });

  for (const draft of drafts) {
    const tagSlugs = Array.from(
      new Set(draft.tagSlugs.map((slug) => (slug === sourceSlug ? targetSlug : slug))),
    );
    await tx.adminArticleEditorDraft.update({ where: { id: draft.id }, data: { tagSlugs } });
  }
}

function toTag(record: Prisma.ArticleTagGetPayload<{ select: typeof tagSelect }>) {
  return {
    articleCount: record._count.articles,
    createdAt: record.createdAt,
    id: record.id,
    name: record.name,
    slug: record.slug,
    updatedAt: record.updatedAt,
  };
}
function unique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
function missing(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
function foreignKey(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export { PrismaAdminArticleTagRepository };
