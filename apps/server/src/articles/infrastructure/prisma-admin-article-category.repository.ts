import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import {
  AdminArticleCategoryConflictError,
  type AdminArticleCategoryRepository,
  type AdminArticleCategoryWriteInput,
} from "../domain/admin-article-category.repository";

const categorySelect = {
  _count: {
    select: {
      articles: true,
    },
  },
  createdAt: true,
  description: true,
  id: true,
  name: true,
  slug: true,
  updatedAt: true,
} satisfies Prisma.ArticleCategorySelect;

@Injectable()
class PrismaAdminArticleCategoryRepository implements AdminArticleCategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: AdminArticleCategoryWriteInput) {
    try {
      const record = await this.prisma.articleCategory.create({
        data: input,
        select: categorySelect,
      });

      return toCategory(record);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AdminArticleCategoryConflictError();
      }

      throw error;
    }
  }

  async delete(id: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const category = await tx.articleCategory.findUnique({
          select: { _count: { select: { articles: true } }, slug: true },
          where: { id },
        });
        if (!category) return "NOT_FOUND" as const;
        const draftCount = await tx.adminArticleEditorDraft.count({
          where: { categorySlug: category.slug },
        });
        if (category._count.articles > 0 || draftCount > 0) return "IN_USE" as const;
        await tx.articleCategory.delete({ where: { id } });
        return "DELETED" as const;
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return "NOT_FOUND" as const;
      }

      if (isForeignKeyConstraintError(error)) {
        return "IN_USE" as const;
      }

      throw error;
    }
  }

  async list(input: { page: number; pageSize: number; search?: string }) {
    const where: Prisma.ArticleCategoryWhereInput = input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
            { description: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {};
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.articleCategory.findMany({
        orderBy: [{ name: "asc" }, { slug: "asc" }],
        select: categorySelect,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        where,
      }),
      this.prisma.articleCategory.count({ where }),
    ]);

    return {
      data: records.map(toCategory),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async update(id: string, input: Partial<AdminArticleCategoryWriteInput>) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.articleCategory.findUnique({
          where: { id },
          select: { slug: true },
        });
        if (!existing) return null;
        const record = await tx.articleCategory.update({
          data: input,
          select: categorySelect,
          where: { id },
        });
        if (record.slug !== existing.slug) {
          await tx.adminArticleEditorDraft.updateMany({
            where: { categorySlug: existing.slug },
            data: { categorySlug: record.slug },
          });
        }
        return toCategory(record);
      });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }

      if (isUniqueConstraintError(error)) {
        throw new AdminArticleCategoryConflictError();
      }

      throw error;
    }
  }
}

function toCategory(record: Prisma.ArticleCategoryGetPayload<{ select: typeof categorySelect }>) {
  return {
    articleCount: record._count.articles,
    createdAt: record.createdAt,
    description: record.description,
    id: record.id,
    name: record.name,
    slug: record.slug,
    updatedAt: record.updatedAt,
  };
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isRecordNotFoundError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

function isForeignKeyConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

export { PrismaAdminArticleCategoryRepository };
