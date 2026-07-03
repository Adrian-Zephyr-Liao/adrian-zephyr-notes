import type {
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
  SiteConfigResponse,
} from "@adrian-zephyr-notes/contracts";
import type { SiteAnnouncement } from "../domain/site-announcement.entity";
import type { SiteConfigSettings } from "../domain/site-settings";

function toSiteConfigResponse(input: {
  announcements: SiteAnnouncement[];
  settings: SiteConfigSettings;
}): SiteConfigResponse {
  return {
    announcements: input.announcements.map(toSiteAnnouncementResponse),
    home: input.settings.home,
    navigationItems: input.settings.navigationItems,
    socialLinks: input.settings.socialLinks,
  };
}

function toAdminSiteConfigResponse(input: {
  announcements: SiteAnnouncement[];
  settings: SiteConfigSettings;
}): AdminSiteConfigResponse {
  return {
    ...toSiteConfigResponse(input),
    announcements: input.announcements.map(toAdminSiteAnnouncementResponse),
  };
}

function toSiteAnnouncementResponse(announcement: SiteAnnouncement) {
  return {
    id: announcement.id,
    title: announcement.title,
    icon: announcement.icon,
    iconClassName: announcement.iconClassName,
    process: announcement.process,
    status: announcement.status,
    command: announcement.command,
    output: announcement.output,
    sortOrder: announcement.sortOrder,
    updatedAt: announcement.updatedAt.toISOString(),
  };
}

function toAdminSiteAnnouncementResponse(
  announcement: SiteAnnouncement,
): AdminSiteAnnouncementResponse {
  return {
    ...toSiteAnnouncementResponse(announcement),
    key: announcement.key,
    isEnabled: announcement.isEnabled,
    createdAt: announcement.createdAt.toISOString(),
  };
}

export {
  toAdminSiteAnnouncementResponse,
  toAdminSiteConfigResponse,
  toSiteAnnouncementResponse,
  toSiteConfigResponse,
};
