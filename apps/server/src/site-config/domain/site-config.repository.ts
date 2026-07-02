import type { SiteAnnouncement } from "./site-announcement.entity";

type SiteConfigRepository = {
  listEnabledAnnouncements(): Promise<SiteAnnouncement[]>;
};

const SITE_CONFIG_REPOSITORY = Symbol("SITE_CONFIG_REPOSITORY");

export { SITE_CONFIG_REPOSITORY };
export type { SiteConfigRepository };
