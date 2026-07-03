import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type AdminArticleEditorDraft as PrismaAdminArticleEditorDraft,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { shouldAcceptAdminArticleEditorDraftSave } from "../domain/admin-article-editor-draft-save-policy";
import {
  createAdminArticleEditorDraftScope,
  type AdminArticleEditorDraft,
  type AdminArticleEditorDraftRepository,
  type SaveAdminArticleEditorDraftRepositoryInput,
} from "../domain/admin-article-editor-draft.repository";

@Injectable()
class PrismaAdminArticleEditorDraftRepository implements AdminArticleEditorDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCurrent(input: { articleId: string | null; ownerUserId: string }) {
    const record = await this.prisma.adminArticleEditorDraft.findUnique({
      where: {
        ownerUserId_scope: {
          ownerUserId: input.ownerUserId,
          scope: createAdminArticleEditorDraftScope(input.articleId),
        },
      },
    });

    return record ? toAdminArticleEditorDraft(record) : null;
  }

  async saveCurrent(input: SaveAdminArticleEditorDraftRepositoryInput) {
    const scope = createAdminArticleEditorDraftScope(input.articleId);
    const data = toAdminArticleEditorDraftPersistenceData(input, scope);

    const updated = await this.prisma.adminArticleEditorDraft.updateMany({
      where: {
        ownerUserId: input.ownerUserId,
        scope,
        OR: [
          {
            clientSavedAt: null,
          },
          {
            clientSavedAt: {
              lte: input.clientSavedAt,
            },
          },
        ],
      },
      data,
    });

    if (updated.count > 0) {
      return await this.findCurrentOrThrow(input.ownerUserId, input.articleId);
    }

    const existing = await this.findCurrent({
      ownerUserId: input.ownerUserId,
      articleId: input.articleId,
    });

    if (existing) {
      if (
        !shouldAcceptAdminArticleEditorDraftSave({
          existingSavedAt: existing.savedAt,
          incomingSavedAt: input.clientSavedAt,
        })
      ) {
        return existing;
      }

      return await this.saveCurrent(input);
    }

    try {
      const created = await this.prisma.adminArticleEditorDraft.create({
        data,
      });

      return toAdminArticleEditorDraft(created);
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return await this.saveCurrent(input);
      }

      throw error;
    }
  }

  async deleteCurrent(input: { articleId: string | null; ownerUserId: string }) {
    const result = await this.prisma.adminArticleEditorDraft.deleteMany({
      where: {
        ownerUserId: input.ownerUserId,
        scope: createAdminArticleEditorDraftScope(input.articleId),
      },
    });

    return result.count > 0;
  }

  private async findCurrentOrThrow(ownerUserId: string, articleId: string | null) {
    const record = await this.findCurrent({ ownerUserId, articleId });

    if (!record) {
      throw new Error("Saved article editor draft could not be loaded.");
    }

    return record;
  }
}

function toAdminArticleEditorDraftPersistenceData(
  input: SaveAdminArticleEditorDraftRepositoryInput,
  scope: string,
) {
  return {
    ownerUserId: input.ownerUserId,
    scope,
    articleId: input.articleId,
    title: input.values.title,
    description: input.values.description,
    markdown: input.values.markdown,
    status: input.values.status,
    categorySlug: input.values.categorySlug || null,
    tagSlugs: input.values.tagSlugs,
    coverImageUrl: input.values.coverImageUrl || null,
    baseArticleUpdatedAt: input.baseArticleUpdatedAt,
    clientSavedAt: input.clientSavedAt,
  };
}

function toAdminArticleEditorDraft(record: PrismaAdminArticleEditorDraft): AdminArticleEditorDraft {
  const savedAt = record.clientSavedAt ?? record.updatedAt;

  return {
    id: record.id,
    ownerUserId: record.ownerUserId,
    articleId: record.articleId,
    baseArticleUpdatedAt: record.baseArticleUpdatedAt,
    savedAt,
    values: {
      title: record.title,
      description: record.description,
      markdown: record.markdown,
      status: record.status,
      categorySlug: record.categorySlug ?? "",
      tagSlugs: record.tagSlugs,
      coverImageUrl: record.coverImageUrl ?? "",
    },
  };
}

function isPrismaUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export { PrismaAdminArticleEditorDraftRepository };
