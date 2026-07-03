import { Inject, Injectable } from "@nestjs/common";
import {
  SITE_CONFIG_REPOSITORY,
  type SiteConfigRepository,
} from "../domain/site-config.repository";
import { normalizeSiteConfigSettings, type SiteConfigSettings } from "../domain/site-settings";
import { AdminSiteConfigValidationError } from "./admin-site-config.errors";

@Injectable()
class UpdateAdminSiteSettingsUseCase {
  constructor(
    @Inject(SITE_CONFIG_REPOSITORY)
    private readonly siteConfigRepository: SiteConfigRepository,
  ) {}

  execute(input: SiteConfigSettings) {
    try {
      return this.siteConfigRepository.saveSettings(normalizeSiteConfigSettings(input));
    } catch (error) {
      throw new AdminSiteConfigValidationError(toErrorMessage(error));
    }
  }
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Invalid site settings.";
}

export { UpdateAdminSiteSettingsUseCase };
