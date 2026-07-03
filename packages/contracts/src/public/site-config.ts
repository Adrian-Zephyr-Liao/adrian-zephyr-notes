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

type SiteNavigationItemResponse = {
  id: string;
  label: string;
  href: string;
  isExternal: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

type SiteSocialLinkResponse = {
  id: string;
  label: string;
  href: string;
  icon: string;
  isExternal: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

type SiteHomeConfigResponse = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel: string | null;
  secondaryActionHref: string | null;
};

type SiteConfigResponse = {
  announcements: SiteAnnouncementResponse[];
  home: SiteHomeConfigResponse;
  navigationItems: SiteNavigationItemResponse[];
  socialLinks: SiteSocialLinkResponse[];
};

export type {
  SiteAnnouncementResponse,
  SiteConfigResponse,
  SiteHomeConfigResponse,
  SiteNavigationItemResponse,
  SiteSocialLinkResponse,
};
