import { Link } from "@tanstack/react-router";
import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import {
  BookOpenText,
  Bot,
  ChevronRight,
  FileText,
  FolderTree,
  Gauge,
  LogOut,
  MessageCircle,
  Moon,
  NotebookPen,
  Settings2,
  ShieldCheck,
  Sun,
  Tags,
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

type AdminSectionKey =
  | "agent"
  | "articles"
  | "audit"
  | "comments"
  | "guestbook"
  | "overview"
  | "site";
type AdminShellProps = {
  admin: AdminUserResponse;
  articlePage?: "categories" | "list" | "tags";
  children: ReactNode;
  onLogout: () => void;
  section: AdminSectionKey;
};
type AdminNavItem = {
  badge?: string;
  icon: LucideIcon;
  key: AdminSectionKey;
  label: string;
  to: "/" | "/agent" | "/articles" | "/audit" | "/comments" | "/guestbook" | "/site";
};
type AdminNavGroup = {
  items: AdminNavItem[];
  label: string;
};

function AdminShell({ admin, articlePage, children, onLogout, section }: AdminShellProps) {
  const sectionMeta =
    section === "articles" && articlePage
      ? articlePageMeta[articlePage]
      : adminSectionMeta[section];
  const navGroups = useMemo(() => createAdminNavGroups(), []);

  return (
    <main className="min-h-dvh bg-(--gradient-soft) text-foreground">
      <a
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-(--shadow-glass-strong) transition-transform focus:translate-y-0 motion-reduce:transition-none"
        href="#admin-content"
      >
        跳到主要内容
      </a>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between gap-3">
              <Link className="flex min-w-0 items-center gap-3" to="/">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground shadow-(--shadow-glass) ring-1 ring-white/25">
                  AZ
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">AZ Notes</p>
                  <p className="truncate text-xs text-muted-foreground">Content Studio</p>
                </div>
              </Link>
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
                        {item.key === "articles" && section === "articles" ? (
                          <ul className="mt-2 flex gap-1 border-l-0 pl-0 lg:mt-1 lg:ml-4 lg:grid lg:border-l lg:border-border/55 lg:pl-3">
                            <ArticleSubmenuItem
                              icon={FileText}
                              isActive={articlePage === "list"}
                              label="文章列表"
                              to="/articles"
                            />
                            <ArticleSubmenuItem
                              icon={FolderTree}
                              isActive={articlePage === "categories"}
                              label="分类管理"
                              to="/articles/categories"
                            />
                            <ArticleSubmenuItem
                              icon={Tags}
                              isActive={articlePage === "tags"}
                              label="标签管理"
                              to="/articles/tags"
                            />
                          </ul>
                        ) : null}
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
                  className="size-8 rounded-full ring-1 ring-foreground/10"
                  src={admin.avatarUrl}
                />
              ) : (
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
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
            <header className="sticky top-0 z-20 flex min-h-20 w-full items-center border-b border-(--glass-border) bg-(--glass-surface-strong) px-4 py-3 shadow-(--shadow-glass) backdrop-blur-2xl sm:px-6 lg:px-8 dark:border-transparent">
              <div>
                {section === "articles" ? (
                  <nav
                    aria-label="面包屑"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <Link
                      className="transition-colors duration-150 ease-(--ease-out-ui) hover:text-foreground"
                      to="/articles"
                    >
                      文章工作台
                    </Link>
                    <ChevronRight className="size-3" />
                    <span aria-current="page">{sectionMeta.title}</span>
                  </nav>
                ) : null}
                <h1 className="mt-1 text-xl font-semibold tracking-normal">{sectionMeta.title}</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">{sectionMeta.description}</p>
              </div>
            </header>
          )}
          <div
            id="admin-content"
            className={cn(
              "mx-auto w-full max-w-[1600px] p-3 sm:p-5 lg:p-7",
              section === "agent" && "max-w-none p-2 sm:p-3 lg:p-4",
            )}
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
    description: "用对话与可确认任务协助内容运营。",
    title: "Agent 工作台",
  },
  articles: {
    description: "管理文章、分类、标签与发布进度。",
    title: "文章工作台",
  },
  audit: {
    description: "追踪后台写操作与治理记录。",
    title: "审计日志",
  },
  comments: {
    description: "结合文章和回复上下文处理评论。",
    title: "评论治理",
  },
  guestbook: {
    description: "管理留言可见性、置顶和软删除。",
    title: "留言板治理",
  },
  overview: {
    description: "聚合内容进度、互动治理和系统动态。",
    title: "运营工作台",
  },
  site: {
    description: "维护读者侧展示与 Agent 治理策略。",
    title: "站点配置",
  },
};

const articlePageMeta = {
  categories: {
    description: "维护文章分类及其用途说明。",
    title: "分类管理",
  },
  list: {
    description: "检索、筛选并维护全部文章。",
    title: "文章列表",
  },
  tags: {
    description: "规范标签并合并重复条目。",
    title: "标签管理",
  },
} satisfies Record<
  NonNullable<AdminShellProps["articlePage"]>,
  { description: string; title: string }
>;

function ArticleSubmenuItem({
  icon: Icon,
  isActive,
  label,
  to,
}: {
  icon: LucideIcon;
  isActive: boolean;
  label: string;
  to: "/articles" | "/articles/categories" | "/articles/tags";
}) {
  return (
    <li>
      <Link
        className={cn(
          "flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap text-muted-foreground transition-[background-color,color,box-shadow,scale] duration-200 ease-(--ease-out-ui) hover:bg-background/45 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",
          isActive && "bg-primary/10 font-medium text-foreground",
        )}
        to={to}
      >
        <Icon className="size-3.5" />
        <span>{label}</span>
      </Link>
    </li>
  );
}

function createAdminNavGroups(): AdminNavGroup[] {
  return [
    {
      label: "总览",
      items: [
        {
          icon: Gauge,
          key: "overview",
          label: "运营工作台",
          to: "/",
        },
      ],
    },
    {
      label: "创作",
      items: [
        {
          icon: NotebookPen,
          key: "articles",
          label: "文章",
          to: "/articles",
        },
        {
          icon: Bot,
          key: "agent",
          label: "Agent 助手",
          to: "/agent",
        },
      ],
    },
    {
      label: "互动",
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
      label: "系统",
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
