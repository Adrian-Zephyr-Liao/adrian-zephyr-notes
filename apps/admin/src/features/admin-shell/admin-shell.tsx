import { Link } from "@tanstack/react-router";
import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import {
  BookOpenText,
  Bot,
  LogOut,
  MessageCircle,
  Moon,
  NotebookPen,
  Settings2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "../../components/ui/sidebar";
import { logoutAdmin } from "../../lib/admin-api";
import { cn } from "../../lib/utils";

type AdminSectionKey = "agent" | "articles" | "audit" | "comments" | "guestbook" | "site";
type AdminShellProps = {
  admin: AdminUserResponse;
  children: ReactNode;
  onLogout: () => void;
  section: AdminSectionKey;
};
type AdminNavItem = {
  badge?: string;
  icon: LucideIcon;
  key: AdminSectionKey;
  label: string;
  to: "/agent" | "/articles" | "/audit" | "/comments" | "/guestbook" | "/site";
};
type AdminNavGroup = {
  items: AdminNavItem[];
  label: string;
};

function AdminShell({ admin, children, onLogout, section }: AdminShellProps) {
  const sectionMeta = adminSectionMeta[section];
  const navGroups = useMemo(() => createAdminNavGroups(), []);

  return (
    <main className="min-h-dvh bg-(--gradient-soft) text-foreground">
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-(--shadow-glass)">
                  AZ
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">AZ Notes</p>
                  <p className="truncate text-xs text-muted-foreground">Content Studio</p>
                </div>
              </div>
              <ThemeToggle />
            </div>
          </SidebarHeader>

          <SidebarContent>
            {navGroups.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={section === item.key}>
                          <Link to={item.to}>
                            <item.icon />
                            <span>{item.label}</span>
                            {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter>
            <div className="flex items-center gap-3">
              {admin.avatarUrl ? (
                <img
                  alt={admin.login}
                  className="size-9 rounded-full ring-1 ring-border"
                  src={admin.avatarUrl}
                />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {admin.login.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{admin.name ?? admin.login}</p>
                <p className="truncate text-xs text-muted-foreground">@{admin.login}</p>
              </div>
              <Button
                aria-label="退出登录"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => {
                  void logoutAdmin().finally(onLogout);
                }}
              >
                <LogOut />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className={cn(section === "agent" && "overflow-hidden")}>
          {section === "agent" ? null : (
            <header className="sticky top-0 z-20 flex min-h-20 w-full items-center justify-between gap-4 border-b border-border/70 bg-background/70 p-4 backdrop-blur-xl sm:px-6 lg:px-8">
              <div>
                <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                  Studio
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-normal">{sectionMeta.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{sectionMeta.description}</p>
              </div>
            </header>
          )}
          <div
            className={cn("w-full p-3 sm:p-5 lg:p-6", section === "agent" && "p-2 sm:p-3 lg:p-4")}
          >
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
}

const adminSectionMeta: Record<AdminSectionKey, { description: string; title: string }> = {
  agent: {
    description: "把评论、文章、留言、站点配置和审计入口收束到 Agent 对话中",
    title: "Agent 工作台",
  },
  articles: {
    description: "以写作流为中心管理 Markdown、发布状态和 AI 摘要",
    title: "文章工作台",
  },
  audit: {
    description: "查看管理员写操作记录和来源上下文",
    title: "审计日志",
  },
  comments: {
    description: "查看评论上下文，处理隐藏与恢复",
    title: "评论治理",
  },
  guestbook: {
    description: "审核留言、置顶重点反馈，并支持软删除与恢复",
    title: "留言板治理",
  },
  site: {
    description: "管理公告、导航、社交链接和首页配置",
    title: "站点配置",
  },
};

function createAdminNavGroups(): AdminNavGroup[] {
  return [
    {
      label: "Write",
      items: [
        {
          icon: Bot,
          key: "agent",
          label: "Agent 工作台",
          to: "/agent",
        },
        {
          icon: NotebookPen,
          key: "articles",
          label: "文章",
          to: "/articles",
        },
      ],
    },
    {
      label: "Discuss",
      items: [
        {
          icon: MessageCircle,
          key: "comments",
          label: "评论",
          to: "/comments",
        },
        {
          icon: BookOpenText,
          key: "guestbook",
          label: "留言板",
          to: "/guestbook",
        },
      ],
    },
    {
      label: "Operate",
      items: [
        {
          icon: Settings2,
          key: "site",
          label: "站点配置",
          to: "/site",
        },
        {
          icon: ShieldCheck,
          key: "audit",
          label: "审计日志",
          to: "/audit",
        },
      ],
    },
  ];
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    typeof window === "undefined"
      ? "dark"
      : window.localStorage.getItem("admin-theme") === "light"
        ? "light"
        : "dark",
  );

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    window.localStorage.setItem("admin-theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
  }

  return (
    <Button aria-label="切换主题" size="icon" type="button" variant="outline" onClick={toggleTheme}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}

export { AdminShell };
export type { AdminSectionKey };
