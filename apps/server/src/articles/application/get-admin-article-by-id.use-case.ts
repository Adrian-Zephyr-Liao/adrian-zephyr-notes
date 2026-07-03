import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_REPOSITORY,
  type AdminArticleRepository,
} from "../domain/admin-article.repository";
import { AdminArticleNotFoundError } from "./admin-article.errors";

@Injectable()
class GetAdminArticleByIdUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_REPOSITORY)
    private readonly adminArticleRepository: AdminArticleRepository,
  ) {}

  async execute(id: string) {
    const article = await this.adminArticleRepository.findById(id);

    if (!article) {
      throw new AdminArticleNotFoundError();
    }

    return article;
  }
}

export { GetAdminArticleByIdUseCase };
