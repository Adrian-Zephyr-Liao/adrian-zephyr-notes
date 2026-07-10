import type {
  SiteAnnouncementResponse,
  SiteConfigResponse,
  SiteHomeConfigResponse,
  SiteNavigationItemResponse,
  SiteSocialLinkResponse,
} from "../public/site-config.js";
import type { AdminAgentAutomationPolicyResponse } from "./agent.js";

type AdminSiteAnnouncementResponse = SiteAnnouncementResponse & {
  key: string;
  isEnabled: boolean;
  createdAt: string;
};

type AdminSiteConfigResponse = Omit<SiteConfigResponse, "announcements"> & {
  adminAgentAutomationPolicy: AdminAgentAutomationPolicyResponse;
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
  adminAgentAutomationPolicy: AdminAgentAutomationPolicyResponse;
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
