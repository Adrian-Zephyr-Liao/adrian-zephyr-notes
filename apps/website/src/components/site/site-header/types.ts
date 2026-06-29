import type { ComponentType } from "react";

type SiteIcon = ComponentType<{ className?: string }>;

type NavChild = {
  href: string;
  label: string;
  icon: SiteIcon;
  external?: boolean;
};

type PortalLink = NavChild & {
  description: string;
  tone: string;
};

type NavGroup = {
  label: string;
  items: NavChild[];
};

export type { NavChild, NavGroup, PortalLink };
