import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_REPOSITORY,
  type AdminArticleRepository,
} from "../domain/admin-article.repository";
import { AdminArticleNotFoundError } from "./admin-article.errors";

@Injectable()
class DeleteAdminArticleUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_REPOSITORY)
    private readonly adminArticleRepository: AdminArticleRepository,
  ) {}

  async execute(id: string) {
    const deleted = await this.adminArticleRepository.delete(id.trim());

    if (!deleted) {
      throw new AdminArticleNotFoundError();
    }
  }
}

export { DeleteAdminArticleUseCase };
