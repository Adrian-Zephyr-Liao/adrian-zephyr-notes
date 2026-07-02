type SiteAnnouncementResponse = {
  id: string;
  title: string;
  icon: string;
  iconClassName: string;
  process: string;
  status: string;
  command: string;
  output: string;
  sortOrder: number;
  updatedAt: string;
};

type SiteConfigResponse = {
  announcements: SiteAnnouncementResponse[];
};

export type { SiteAnnouncementResponse, SiteConfigResponse };
