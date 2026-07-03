import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_ARTICLE_REPOSITORY,
  type AdminArticleRepository,
} from "../domain/admin-article.repository";

@Injectable()
class ListAdminArticleTaxonomiesUseCase {
  constructor(
    @Inject(ADMIN_ARTICLE_REPOSITORY)
    private readonly adminArticleRepository: AdminArticleRepository,
  ) {}

  execute() {
    return this.adminArticleRepository.listTaxonomyOptions();
  }
}

export { ListAdminArticleTaxonomiesUseCase };
