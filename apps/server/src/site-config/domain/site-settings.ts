import {
  getDefaultAdminAgentAutomationPolicy,
  normalizeAdminAgentAutomationPolicy,
  type AdminAgentAutomationPolicy,
} from "../../admin-agent/domain/admin-agent-automation-policy";

type SiteNavigationItem = {
  id: string;
  label: string;
  href: string;
  isExternal: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

type SiteSocialLink = {
  id: string;
  label: string;
  href: string;
  icon: string;
  isExternal: boolean;
  isEnabled: boolean;
  sortOrder: number;
};

type SiteHomeConfig = {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryActionLabel: string;
  primaryActionHref: string;
  secondaryActionLabel: string | null;
  secondaryActionHref: string | null;
};

type SiteConfigSettings = {
  adminAgentAutomationPolicy: AdminAgentAutomationPolicy;
  home: SiteHomeConfig;
  navigationItems: SiteNavigationItem[];
  socialLinks: SiteSocialLink[];
};

const defaultSiteConfigSettings: SiteConfigSettings = {
  adminAgentAutomationPolicy: getDefaultAdminAgentAutomationPolicy(),
  home: {
    eyebrow: "Adrian Zephyr Notes",
    title: "记录工程、写作和长期思考",
    subtitle: "把实践里的问题、方案和取舍整理成可以反复阅读的笔记。",
    primaryActionLabel: "阅读文章",
    primaryActionHref: "/posts/5f7448b7",
    secondaryActionLabel: "留言",
    secondaryActionHref: "/guestbook",
  },
  navigationItems: [
    {
      id: "home",
      label: "首页",
      href: "/",
      isExternal: false,
      isEnabled: true,
      sortOrder: 10,
    },
    {
      id: "posts",
      label: "文章",
      href: "/posts/5f7448b7",
      isExternal: false,
      isEnabled: true,
      sortOrder: 20,
    },
    {
      id: "guestbook",
      label: "留言板",
      href: "/guestbook",
      isExternal: false,
      isEnabled: true,
      sortOrder: 30,
    },
  ],
  socialLinks: [
    {
      id: "github",
      label: "GitHub",
      href: "https://github.com/Adrian-Zephyr-Liao",
      icon: "github",
      isExternal: true,
      isEnabled: true,
      sortOrder: 10,
    },
  ],
};

function normalizeSiteConfigSettings(input: SiteConfigSettings): SiteConfigSettings {
  return {
    adminAgentAutomationPolicy: normalizeAdminAgentAutomationPolicy(
      input.adminAgentAutomationPolicy,
    ),
    home: normalizeHomeConfig(input.home),
    navigationItems: normalizeNavigationItems(input.navigationItems),
    socialLinks: normalizeSocialLinks(input.socialLinks),
  };
}

function normalizeHomeConfig(input: SiteHomeConfig): SiteHomeConfig {
  return {
    eyebrow: requireText(input.eyebrow, "Home eyebrow"),
    title: requireText(input.title, "Home title"),
    subtitle: requireText(input.subtitle, "Home subtitle"),
    primaryActionLabel: requireText(input.primaryActionLabel, "Home primary action label"),
    primaryActionHref: requireText(input.primaryActionHref, "Home primary action href"),
    secondaryActionLabel: normalizeOptionalText(input.secondaryActionLabel),
    secondaryActionHref: normalizeOptionalText(input.secondaryActionHref),
  };
}

function normalizeNavigationItems(input: SiteNavigationItem[]) {
  return input.map((item) => ({
    id: requireText(item.id, "Navigation item id"),
    label: requireText(item.label, "Navigation item label"),
    href: requireText(item.href, "Navigation item href"),
    isExternal: Boolean(item.isExternal),
    isEnabled: Boolean(item.isEnabled),
    sortOrder: normalizeInteger(item.sortOrder),
  }));
}

function normalizeSocialLinks(input: SiteSocialLink[]) {
  return input.map((link) => ({
    id: requireText(link.id, "Social link id"),
    label: requireText(link.label, "Social link label"),
    href: requireText(link.href, "Social link href"),
    icon: requireText(link.icon, "Social link icon"),
    isExternal: Boolean(link.isExternal),
    isEnabled: Boolean(link.isEnabled),
    sortOrder: normalizeInteger(link.sortOrder),
  }));
}

function requireText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeInteger(value: number) {
  return Number.isInteger(value) ? value : 0;
}

export { defaultSiteConfigSettings, normalizeSiteConfigSettings };
export type { SiteConfigSettings, SiteHomeConfig, SiteNavigationItem, SiteSocialLink };
