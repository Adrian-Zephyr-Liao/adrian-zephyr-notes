import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_TAG_REPOSITORY,
  AdminArticleTagInUseError,
  AdminArticleTagNotFoundError,
  AdminArticleTagValidationError,
  type AdminArticleTagRepository,
  type AdminArticleTagMergeAudit,
  type AdminArticleTagWriteInput,
} from "../domain/admin-article-tag.repository";

type TagInput = { name: string; slug: string };

@Injectable()
class CreateAdminArticleTagUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_TAG_REPOSITORY) private readonly repository: AdminArticleTagRepository,
  ) {}
  execute(input: TagInput) {
    return this.repository.create(normalizeTag(input));
  }
}

@Injectable()
class ListAdminArticleTagsUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_TAG_REPOSITORY) private readonly repository: AdminArticleTagRepository,
  ) {}
  execute(input: { page?: number; pageSize?: number; q?: string } = {}) {
    return this.repository.list({
      page: positive(input.page, 1),
      pageSize: Math.min(positive(input.pageSize, 20), 50),
      search: optional(input.q) ?? undefined,
    });
  }
}

@Injectable()
class UpdateAdminArticleTagUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_TAG_REPOSITORY) private readonly repository: AdminArticleTagRepository,
  ) {}
  async execute(id: string, input: Partial<TagInput>) {
    const update: Partial<AdminArticleTagWriteInput> = {};
    if (input.name !== undefined) update.name = required(input.name, "Tag name");
    if (input.slug !== undefined) update.slug = tagSlug(input.slug);
    if (!Object.keys(update).length)
      throw new AdminArticleTagValidationError("Tag update requires a field.");
    const tag = await this.repository.update(required(id, "Tag id"), update);
    if (!tag) throw new AdminArticleTagNotFoundError();
    return tag;
  }
}

@Injectable()
class DeleteAdminArticleTagUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_TAG_REPOSITORY) private readonly repository: AdminArticleTagRepository,
  ) {}
  async execute(id: string) {
    const result = await this.repository.delete(required(id, "Tag id"));
    if (result === "NOT_FOUND") throw new AdminArticleTagNotFoundError();
    if (result === "IN_USE") throw new AdminArticleTagInUseError();
  }
}

@Injectable()
class MergeAdminArticleTagUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_TAG_REPOSITORY) private readonly repository: AdminArticleTagRepository,
  ) {}
  async execute(sourceId: string, targetId: string, audit: AdminArticleTagMergeAudit) {
    const source = required(sourceId, "Source tag id");
    const target = required(targetId, "Target tag id");
    if (source === target)
      throw new AdminArticleTagValidationError("A tag cannot be merged into itself.");
    const merged = await this.repository.merge(source, target, audit);
    if (!merged) throw new AdminArticleTagNotFoundError();
    return merged;
  }
}

function normalizeTag(input: TagInput): AdminArticleTagWriteInput {
  return { name: required(input.name, "Tag name"), slug: tagSlug(input.slug) };
}
function tagSlug(value: string) {
  const slug = required(value, "Tag slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new AdminArticleTagValidationError(
      "Tag slug must use lowercase letters, numbers, and hyphens.",
    );
  }
  return slug;
}
function required(value: string, field: string) {
  const text = value.trim();
  if (!text) throw new AdminArticleTagValidationError(`${field} cannot be empty.`);
  return text;
}
function optional(value?: string) {
  const text = value?.trim();
  return text || null;
}
function positive(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && value !== undefined && value > 0 ? value : fallback;
}

export {
  CreateAdminArticleTagUseCase,
  DeleteAdminArticleTagUseCase,
  ListAdminArticleTagsUseCase,
  MergeAdminArticleTagUseCase,
  UpdateAdminArticleTagUseCase,
};
