import { Inject, Injectable } from "@nestjs/common";
import {
  SITE_CONFIG_REPOSITORY,
  type SiteConfigRepository,
} from "../domain/site-config.repository";

@Injectable()
class GetPublicSiteConfigUseCase {
  constructor(
    @Inject(SITE_CONFIG_REPOSITORY)
    private readonly siteConfigRepository: SiteConfigRepository,
  ) {}

  async execute() {
    return {
      announcements: await this.siteConfigRepository.listEnabledAnnouncements(),
    };
  }
}

export { GetPublicSiteConfigUseCase };
