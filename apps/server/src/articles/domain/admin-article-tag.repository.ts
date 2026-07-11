type AdminArticleTag = {
  articleCount: number;
  createdAt: Date;
  id: string;
  name: string;
  slug: string;
  updatedAt: Date;
};

type AdminArticleTagPage = {
  data: AdminArticleTag[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

type AdminArticleTagWriteInput = { name: string; slug: string };
type AdminArticleTagMergeAudit = {
  actorLogin: string;
  actorUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

interface AdminArticleTagRepository {
  create(input: AdminArticleTagWriteInput): Promise<AdminArticleTag>;
  delete(id: string): Promise<"DELETED" | "IN_USE" | "NOT_FOUND">;
  list(input: { page: number; pageSize: number; search?: string }): Promise<AdminArticleTagPage>;
  merge(
    sourceId: string,
    targetId: string,
    audit: AdminArticleTagMergeAudit,
  ): Promise<AdminArticleTag | null>;
  update(id: string, input: Partial<AdminArticleTagWriteInput>): Promise<AdminArticleTag | null>;
}

class AdminArticleTagConflictError extends Error {}
class AdminArticleTagInUseError extends Error {}
class AdminArticleTagNotFoundError extends Error {}
class AdminArticleTagValidationError extends Error {}

const ADMIN_ARTICLE_TAG_REPOSITORY = Symbol("ADMIN_ARTICLE_TAG_REPOSITORY");

export {
  ADMIN_ARTICLE_TAG_REPOSITORY,
  AdminArticleTagConflictError,
  AdminArticleTagInUseError,
  AdminArticleTagNotFoundError,
  AdminArticleTagValidationError,
};
export type {
  AdminArticleTag,
  AdminArticleTagPage,
  AdminArticleTagMergeAudit,
  AdminArticleTagRepository,
  AdminArticleTagWriteInput,
};
