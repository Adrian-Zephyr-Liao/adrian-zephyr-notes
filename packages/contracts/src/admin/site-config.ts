import type {
  SiteAnnouncementResponse,
  SiteConfigResponse,
  SiteHomeConfigResponse,
  SiteNavigationItemResponse,
  SiteSocialLinkResponse,
} from "../public/site-config.js";

type AdminSiteAnnouncementResponse = SiteAnnouncementResponse & {
  key: string;
  isEnabled: boolean;
  createdAt: string;
};

type AdminSiteConfigResponse = Omit<SiteConfigResponse, "announcements"> & {
  announcements: AdminSiteAnnouncementResponse[];
};

type UpdateAdminSiteAnnouncementRequest = {
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

type UpdateAdminSiteSettingsRequest = {
  home: SiteHomeConfigResponse;
  navigationItems: SiteNavigationItemResponse[];
  socialLinks: SiteSocialLinkResponse[];
};

export type {
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
  UpdateAdminSiteAnnouncementRequest,
  UpdateAdminSiteSettingsRequest,
};
