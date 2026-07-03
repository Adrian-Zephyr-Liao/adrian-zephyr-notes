import { createFileRoute } from "@tanstack/react-router";
import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import {
  BookOpenText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Moon,
  NotebookPen,
  Settings2,
  ShieldCheck,
  Sun,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { AdminAuthGate } from "../features/auth/admin-auth-gate";
import { logoutAdmin } from "../lib/admin-api";
import { cn } from "../lib/utils";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";

export const Route = createFileRoute("/")({ component: AdminApp });

const ArticleManagement = lazy(() =>
  import("../features/articles/article-management").then((module) => ({
    default: module.ArticleManagement,
  })),
);
const AuditLogManagement = lazy(() =>
  import("../features/audit/audit-log-management").then((module) => ({
    default: module.AuditLogManagement,
  })),
);
const CommentModeration = lazy(() =>
  import("../features/comments/comment-moderation").then((module) => ({
    default: module.CommentModeration,
  })),
);
const GuestbookModeration = lazy(() =>
  import("../features/guestbook/guestbook-moderation").then((module) => ({
    default: module.GuestbookModeration,
  })),
);
const SiteConfigManagement = lazy(() =>
  import("../features/site-config/site-config-management").then((module) => ({
    default: module.SiteConfigManagement,
  })),
);

type AdminSectionKey = "articles" | "audit" | "comments" | "dashboard" | "guestbook" | "site";
type AdminNavItem = {
  key: AdminSectionKey;
  label: string;
  icon: LucideIcon;
  badge?: string;
  disabled?: boolean;
};
type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

function AdminApp() {
  return (
    <AdminAuthGate>
      {(admin, onLogout) => <AdminShell admin={admin} onLogout={onLogout} />}
    </AdminAuthGate>
  );
}

function AdminShell({ admin, onLogout }: { admin: AdminUserResponse; onLogout: () => void }) {
  const [section, setSection] = useState<AdminSectionKey>("articles");
  const sectionMeta = adminSectionMeta[section];
  const navGroups = useMemo(() => createAdminNavGroups(), []);

  return (
    <main className="min-h-screen bg-(--gradient-soft) text-foreground">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-[256px_1fr]">
        <aside className="border-b border-border/70 bg-background/55 p-4 backdrop-blur-xl lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground shadow-(--shadow-glass)">
                AZ
              </span>
              <div>
                <p className="font-semibold">AZ Notes</p>
                <p className="text-xs text-muted-foreground">Content Studio</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
          <nav className="mt-5 grid gap-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {group.label}
                </p>
                <div className="grid gap-1">
                  {group.items.map((item) => (
                    <button
                      key={item.key}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45",
                        section === item.key && "bg-primary/10 text-primary ring-1 ring-primary/15",
                      )}
                      disabled={item.disabled}
                      type="button"
                      onClick={() => setSection(item.key)}
                    >
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                      {item.badge ? (
                        <Badge className="ml-auto" variant="outline">
                          {item.badge}
                        </Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>
        <section className="min-w-0 bg-background/25">
          <header className="sticky top-0 z-20 flex min-h-20 w-full items-center justify-between gap-4 border-b border-border/70 bg-background/70 p-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Studio
              </p>
              <h1 className="mt-1 text-xl font-semibold tracking-normal">{sectionMeta.title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{sectionMeta.description}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{admin.name ?? admin.login}</p>
                <p className="text-xs text-muted-foreground">@{admin.login}</p>
              </div>
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
              <Button
                aria-label="退出登录"
                size="icon"
                variant="ghost"
                onClick={() => {
                  void logoutAdmin().finally(onLogout);
                }}
              >
                <LogOut />
              </Button>
            </div>
          </header>
          <div className="w-full p-3 sm:p-5 lg:p-6">
            <Suspense fallback={<AdminSectionFallback />}>{renderAdminSection(section)}</Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

const adminSectionMeta: Record<AdminSectionKey, { description: string; title: string }> = {
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
  dashboard: {
    description: "查看站点运营概览",
    title: "工作台",
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
          key: "dashboard" as const,
          label: "工作台",
          icon: LayoutDashboard,
          disabled: true,
          badge: "soon",
        },
        {
          key: "articles" as const,
          label: "文章",
          icon: NotebookPen,
        },
      ],
    },
    {
      label: "Discuss",
      items: [
        {
          key: "comments" as const,
          label: "评论",
          icon: MessageCircle,
        },
        {
          key: "guestbook" as const,
          label: "留言板",
          icon: BookOpenText,
        },
      ],
    },
    {
      label: "Operate",
      items: [
        {
          key: "site" as const,
          label: "站点配置",
          icon: Settings2,
        },
        {
          key: "audit" as const,
          label: "审计日志",
          icon: ShieldCheck,
        },
      ],
    },
  ];
}

function renderAdminSection(section: AdminSectionKey) {
  if (section === "audit") {
    return <AuditLogManagement />;
  }

  if (section === "comments") {
    return <CommentModeration />;
  }

  if (section === "guestbook") {
    return <GuestbookModeration />;
  }

  if (section === "site") {
    return <SiteConfigManagement />;
  }

  return <ArticleManagement />;
}

function AdminSectionFallback() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="正在加载管理模块">
      <div className="h-24 animate-pulse rounded-xl border border-border/70 bg-muted/45" />
      <div className="h-72 animate-pulse rounded-xl border border-border/70 bg-muted/35" />
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() =>
    typeof window === "undefined"
      ? "light"
      : window.localStorage.getItem("admin-theme") === "dark"
        ? "dark"
        : "light",
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
