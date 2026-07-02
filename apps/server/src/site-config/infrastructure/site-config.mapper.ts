import type { SiteConfigResponse } from "@adrian-zephyr-notes/contracts";
import type { SiteAnnouncement } from "../domain/site-announcement.entity";

function toSiteConfigResponse(input: { announcements: SiteAnnouncement[] }): SiteConfigResponse {
  return {
    announcements: input.announcements.map(toSiteAnnouncementResponse),
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

export { toSiteAnnouncementResponse, toSiteConfigResponse };
