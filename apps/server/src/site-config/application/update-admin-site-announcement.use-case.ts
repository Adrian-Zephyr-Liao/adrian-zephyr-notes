import { Inject, Injectable } from "@nestjs/common";
import {
  SITE_CONFIG_REPOSITORY,
  type SiteConfigRepository,
  type UpdateSiteAnnouncementInput,
} from "../domain/site-config.repository";
import { AdminSiteAnnouncementNotFoundError } from "./admin-site-config.errors";

type UpdateAdminSiteAnnouncementInput = UpdateSiteAnnouncementInput;

@Injectable()
class UpdateAdminSiteAnnouncementUseCase {
  constructor(
    @Inject(SITE_CONFIG_REPOSITORY)
    private readonly siteConfigRepository: SiteConfigRepository,
  ) {}

  async execute(input: UpdateAdminSiteAnnouncementInput) {
    const announcement = await this.siteConfigRepository.updateAnnouncement(normalizeInput(input));

    if (!announcement) {
      throw new AdminSiteAnnouncementNotFoundError();
    }

    return announcement;
  }
}

function normalizeInput(input: UpdateAdminSiteAnnouncementInput): UpdateSiteAnnouncementInput {
  return {
    id: input.id,
    title: normalizeOptionalText(input.title),
    icon: normalizeOptionalText(input.icon),
    iconClassName: input.iconClassName?.trim(),
    process: normalizeOptionalText(input.process),
    status: normalizeOptionalText(input.status),
    command: normalizeOptionalText(input.command),
    output: normalizeOptionalText(input.output),
    isEnabled: input.isEnabled,
    sortOrder: input.sortOrder,
  };
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export { UpdateAdminSiteAnnouncementUseCase };
export type { UpdateAdminSiteAnnouncementInput };
