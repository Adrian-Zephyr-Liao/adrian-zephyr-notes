import { Inject, Injectable } from "@nestjs/common";
import {
  SITE_CONFIG_REPOSITORY,
  type SiteConfigRepository,
} from "../domain/site-config.repository";

@Injectable()
class GetAdminSiteConfigUseCase {
  constructor(
    @Inject(SITE_CONFIG_REPOSITORY)
    private readonly siteConfigRepository: SiteConfigRepository,
  ) {}

  async execute() {
    const [announcements, settings] = await Promise.all([
      this.siteConfigRepository.listAllAnnouncements(),
      this.siteConfigRepository.getSettings(),
    ]);

    return {
      announcements,
      settings,
    };
  }
}

export { GetAdminSiteConfigUseCase };
