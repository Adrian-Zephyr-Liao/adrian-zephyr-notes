import type { SiteAnnouncement } from "./site-announcement.entity";
import type { SiteConfigSettings } from "./site-settings";

type UpdateSiteAnnouncementInput = {
  id: string;
  title?: string;
  icon?: string;
  iconClassName?: string;
  process?: string;
  status?: string;
  command?: string;
  output?: string;
  isEnabled?: boolean;
  sortOrder?: number;
};

type SiteConfigRepository = {
  getSettings(): Promise<SiteConfigSettings>;
  listAllAnnouncements(): Promise<SiteAnnouncement[]>;
  listEnabledAnnouncements(): Promise<SiteAnnouncement[]>;
  saveSettings(settings: SiteConfigSettings): Promise<SiteConfigSettings>;
  updateAnnouncement(input: UpdateSiteAnnouncementInput): Promise<SiteAnnouncement | null>;
};

const SITE_CONFIG_REPOSITORY = Symbol("SITE_CONFIG_REPOSITORY");

export { SITE_CONFIG_REPOSITORY };
export type { SiteConfigRepository, UpdateSiteAnnouncementInput };
