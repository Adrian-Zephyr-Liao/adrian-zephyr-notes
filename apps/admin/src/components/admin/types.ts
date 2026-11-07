import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type AdminSectionKey =
  | "articles"
  | "assistant"
  | "audit"
  | "comments"
  | "guestbook"
  | "overview"
  | "site";
export type AdminShellProps = {
  admin: AdminUserResponse;
  articlePage?: "categories" | "list" | "tags";
  children: ReactNode;
  onLogout: () => void;
  section: AdminSectionKey;
};
export type AdminNavItem = {
  badge?: string;
  icon: LucideIcon;
  key: AdminSectionKey;
  label: string;
  to: "/" | "/articles" | "/assistant" | "/audit" | "/comments" | "/guestbook" | "/site";
};
export type AdminNavGroup = {
  items: AdminNavItem[];
  label: string;
};
