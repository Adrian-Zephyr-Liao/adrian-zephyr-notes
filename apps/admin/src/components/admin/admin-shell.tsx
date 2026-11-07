import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Dialog } from "radix-ui";
import { Search, X } from "lucide-react";
import { useAdminLogout } from "../../features/auth/use-admin-logout";
import { useAssistantCapabilities } from "../../features/assistant/use-assistant-capabilities";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { AdminAccount } from "./admin-account";
import { AdminNavigationDrawer } from "./admin-navigation";
import { AdminThemeToggle } from "./admin-theme-toggle";
import { adminSectionMeta, articlePageMeta } from "./data";
import type { AdminSectionKey, AdminShellProps } from "./types";

const primaryNavigation = [
  { label: "创作", to: "/", sections: ["overview", "assistant"] },
  { label: "档案", to: "/articles", sections: ["articles"] },
  { label: "互动", to: "/comments", sections: ["comments", "guestbook"] },
  { label: "站点", to: "/site", sections: ["site", "audit"] },
] as const;

function AdminShell({ admin, articlePage, children, onLogout, section }: AdminShellProps) {
  const logoutButton = useRef<HTMLButtonElement>(null);
  const logout = useAdminLogout(onLogout, [logoutButton]);
  const { capabilities } = useAssistantCapabilities(admin.id);
  const assistantEnabled = capabilities?.enabled === true;
  const sectionMeta =
    section === "articles" && articlePage
      ? articlePageMeta[articlePage]
      : adminSectionMeta[section];
  const isAssistant = section === "assistant";
  const ownsHeading = section === "overview" || section === "articles";
  return (
    <div
      className={cn(
        "flex min-h-dvh flex-col bg-background text-foreground",
        isAssistant && "h-dvh overflow-hidden",
      )}
    >
      <a
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground transition-transform focus:translate-y-0"
        href="#admin-content"
      >
        跳到主要内容
      </a>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-4 sm:px-6 lg:h-24 lg:gap-8 lg:px-10 lg:py-0 xl:px-16">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span className="lg:hidden">
            <AdminNavigationDrawer
              section={section}
              articlePage={articlePage}
              assistantEnabled={assistantEnabled}
            />
          </span>
          <Link
            to="/"
            className="shrink-0 rounded-sm font-[Georgia] text-xl font-semibold tracking-[-0.045em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:text-3xl lg:text-4xl"
          >
            AZ Notes
          </Link>
          <div className="hidden border-l border-border pl-5 xl:block">
            <p className="font-display text-sm tracking-wider">个人出版与编辑工作室</p>
            <p className="mt-1 font-[Georgia] text-[9px] tracking-[0.18em] text-muted-foreground">
              THE DIGITAL EDITORIAL ROOM
            </p>
          </div>
        </div>
        <nav
          aria-label="主要管理导航"
          className="hidden h-full items-stretch gap-6 lg:flex xl:gap-9"
        >
          {primaryNavigation.map((item) => {
            const active = (item.sections as readonly AdminSectionKey[]).includes(section);
            return (
              <Link
                key={item.label}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center border-b-3 border-transparent px-1 font-display text-lg transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
                  active && "border-primary text-primary",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <GlobalArticleSearch />
          <AdminThemeToggle />
          <a
            href={admin.profileUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`查看 @${admin.login} 的 GitHub 主页`}
            className="hidden size-9 overflow-hidden rounded-md bg-secondary text-center text-xs leading-9 font-semibold text-secondary-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:block"
          >
            {admin.avatarUrl ? (
              <img alt="" className="size-full object-cover" src={admin.avatarUrl} />
            ) : (
              (admin.name ?? admin.login).slice(0, 2).toUpperCase()
            )}
          </a>
          <AdminAccount
            admin={admin}
            buttonRef={logoutButton}
            onLogout={logout.requestLogout}
            pending={logout.pending}
            showIdentity={false}
          />
        </div>
      </header>
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1800px] shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px] text-muted-foreground sm:px-6 lg:px-10 xl:px-16",
          isAssistant && "max-[800px]:hidden",
        )}
      >
        <p className="font-display tracking-wider">
          AZ NOTES STUDIO <span className="mx-2 text-border">/</span> 编辑室日常
        </p>
        <ContextNavigation section={section} assistantEnabled={assistantEnabled} />
      </div>
      <div
        className={cn(
          "relative mx-auto flex w-full max-w-[1800px] flex-1 flex-col",
          isAssistant && "min-h-0",
        )}
      >
        <aside aria-hidden="true" className="studio-folio">
          <span>AZ NOTES · EDITORIAL STUDIO</span>
        </aside>
        <main
          id="admin-content"
          tabIndex={-1}
          className={cn(
            "mx-4 min-w-0 border-t border-border py-6 outline-none sm:mx-6 sm:py-8 lg:mx-10 xl:mx-16",
            isAssistant && "flex min-h-0 flex-1 flex-col py-4 sm:py-5",
          )}
        >
          {!ownsHeading ? (
            <header className={cn("mb-8", isAssistant && "mb-4 shrink-0")}>
              <p className={cn("studio-kicker mb-4", isAssistant && "hidden min-[900px]:block")}>
                {section === "assistant"
                  ? "06 / ASSISTANT"
                  : section === "audit"
                    ? "07 / ACTIVITY"
                    : section === "site"
                      ? "05 / SITE"
                      : "04 / CORRESPONDENCE"}
              </p>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <h1 className={cn("studio-title", isAssistant && "text-2xl min-[900px]:text-4xl")}>
                  {sectionMeta.title}
                </h1>
                <p
                  className={cn(
                    "max-w-xl text-sm/7 text-muted-foreground lg:border-l lg:border-border lg:pl-6",
                    isAssistant && "max-[900px]:hidden",
                  )}
                >
                  {sectionMeta.description}
                </p>
              </div>
            </header>
          ) : null}
          {children}
        </main>
      </div>
      {logout.feedback}
    </div>
  );
}

function ContextNavigation({
  section,
  assistantEnabled,
}: {
  section: AdminSectionKey;
  assistantEnabled: boolean;
}) {
  const items =
    section === "overview" || section === "assistant"
      ? [
          { label: "创作总览", to: "/" as const },
          ...(assistantEnabled ? [{ label: "管理助手", to: "/assistant" as const }] : []),
        ]
      : section === "site" || section === "audit"
        ? [
            { label: "站点配置", to: "/site" as const },
            { label: "审计日志", to: "/audit" as const },
          ]
        : section === "comments" || section === "guestbook"
          ? [
              { label: "评论", to: "/comments" as const },
              { label: "留言板", to: "/guestbook" as const },
            ]
          : [];
  return (
    <nav aria-label="当前工作区" className="flex items-center gap-5">
      {items.map((item) => (
        <Link
          className="rounded-sm transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          key={item.to}
          to={item.to}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function GlobalArticleSearch() {
  const navigate = useNavigate();
  const searchInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  function search() {
    setOpen(false);
    void navigate({ to: "/articles", search: { q: query.trim() || undefined } });
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className="gap-2 px-2.5 text-muted-foreground lg:w-56 lg:justify-start xl:w-64"
          aria-label="全局搜索文章"
        >
          <Search className="size-4" />
          <span className="hidden text-xs lg:block">搜索文章标题或 slug…</span>
          <kbd className="ml-auto hidden text-[10px] lg:block">⌘ K</kbd>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchInput.current?.focus();
          }}
          className="fixed top-[20%] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-(--shadow-glass-strong)"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="font-display text-2xl font-semibold">搜索文章</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="关闭全局搜索">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="mb-5 text-sm/6 text-muted-foreground">
            按标题或 slug 查找文章，在内容档案中查看结果。
          </Dialog.Description>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
            className="flex gap-2"
          >
            <Input
              ref={searchInput}
              aria-label="全局文章搜索关键词"
              placeholder="输入文章关键词"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button type="submit">搜索</Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export { AdminShell };
export type { AdminSectionKey } from "./types";
