import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_COMMENT_REPOSITORY,
  type AdminArticleCommentRepository,
  type AdminArticleCommentStatus,
  type UpdateAdminArticleCommentStatusInput,
} from "../domain/admin-article-comment.repository";
import {
  AdminArticleCommentNotFoundError,
  AdminArticleCommentValidationError,
} from "./admin-article-comment.errors";

type UpdateAdminArticleCommentStatusUseCaseInput = Omit<
  UpdateAdminArticleCommentStatusInput,
  "status"
> & { status: string };

@Injectable()
class UpdateAdminArticleCommentStatusUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_COMMENT_REPOSITORY)
    private readonly adminArticleCommentRepository: AdminArticleCommentRepository,
  ) {}

  async execute(input: UpdateAdminArticleCommentStatusUseCaseInput) {
    const comment = await this.adminArticleCommentRepository.updateStatus({
      ...input,
      id: input.id,
      status: normalizeCommentStatus(input.status),
    });

    if (!comment) {
      throw new AdminArticleCommentNotFoundError();
    }

    return comment;
  }
}

function normalizeCommentStatus(value: string): AdminArticleCommentStatus {
  if (value === "HIDDEN" || value === "VISIBLE") {
    return value;
  }

  throw new AdminArticleCommentValidationError("Unsupported article comment status.");
}

export { UpdateAdminArticleCommentStatusUseCase, normalizeCommentStatus };
export type { UpdateAdminArticleCommentStatusUseCaseInput };
