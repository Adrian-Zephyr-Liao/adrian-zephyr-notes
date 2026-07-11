import { describe, expect, it } from "vitest";
import type { AdminArticleTagRepository } from "../domain/admin-article-tag.repository";
import {
  AdminArticleTagInUseError,
  AdminArticleTagValidationError,
} from "../domain/admin-article-tag.repository";
import {
  DeleteAdminArticleTagUseCase,
  MergeAdminArticleTagUseCase,
} from "./admin-article-tag.use-cases";

const audit = {
  actorLogin: "admin",
  actorUserId: "user-1",
  ipAddress: "127.0.0.1",
  userAgent: "vitest",
};

describe("admin article tag use cases", () => {
  it("rejects merging a tag into itself", async () => {
    const repository = createRepository();
    await expect(
      new MergeAdminArticleTagUseCase(repository).execute("same", "same", audit),
    ).rejects.toBeInstanceOf(AdminArticleTagValidationError);
  });

  it("delegates a valid merge to the repository", async () => {
    const repository = createRepository();
    await expect(
      new MergeAdminArticleTagUseCase(repository).execute("source", "target", audit),
    ).resolves.toMatchObject({ id: "target" });
    expect(repository.mergeInputs).toEqual([["source", "target", audit]]);
  });

  it("blocks deleting a referenced tag", async () => {
    const repository = createRepository();
    repository.deleteResult = "IN_USE";
    await expect(
      new DeleteAdminArticleTagUseCase(repository).execute("tag-1"),
    ).rejects.toBeInstanceOf(AdminArticleTagInUseError);
  });
});

function createRepository() {
  return {
    deleteResult: "DELETED" as "DELETED" | "IN_USE" | "NOT_FOUND",
    mergeInputs: [] as Array<[string, string, typeof audit]>,
    async create() {
      throw new Error("not used");
    },
    async delete() {
      return this.deleteResult;
    },
    async list() {
      return { data: [], pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 } };
    },
    async merge(sourceId: string, targetId: string, mergeAudit: typeof audit) {
      this.mergeInputs.push([sourceId, targetId, mergeAudit]);
      return {
        articleCount: 2,
        createdAt: new Date(),
        id: targetId,
        name: "Target",
        slug: "target",
        updatedAt: new Date(),
      };
    },
    async update() {
      return null;
    },
  } satisfies AdminArticleTagRepository & {
    deleteResult: "DELETED" | "IN_USE" | "NOT_FOUND";
    mergeInputs: Array<[string, string, typeof audit]>;
  };
}
