import { Link } from "@tanstack/react-router";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from "../ui/sidebar";
import { useAssistantCapabilities } from "../../features/assistant/use-assistant-capabilities";
import { AdminAccount } from "./admin-account";
import { AdminNavigation, AdminNavigationDrawer } from "./admin-navigation";
import { AdminThemeToggle } from "./admin-theme-toggle";
import { adminSectionMeta, articlePageMeta } from "./data";
import type { AdminShellProps } from "./types";

function AdminShell({ admin, articlePage, children, onLogout, section }: AdminShellProps) {
  const sectionMeta =
    section === "articles" && articlePage
      ? articlePageMeta[articlePage]
      : adminSectionMeta[section];
  const { capabilities } = useAssistantCapabilities(admin.id);
  const navigation = { section, articlePage, assistantEnabled: capabilities?.enabled === true };
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <a
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform focus:translate-y-0 motion-reduce:transition-none"
        href="#admin-content"
      >
        跳到主要内容
      </a>
      <SidebarProvider
        className={section === "assistant" ? "h-dvh min-h-0 overflow-hidden" : undefined}
      >
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between gap-2">
              <Brand />
              <AdminThemeToggle />
            </div>
          </SidebarHeader>
          <div className="mt-9 min-h-0 flex-1 overflow-y-auto pb-6">
            <AdminNavigation {...navigation} />
          </div>
          <SidebarFooter>
            <AdminAccount admin={admin} onLogout={onLogout} />
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className={section === "assistant" ? "flex min-h-0 flex-col" : undefined}>
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3 lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <AdminNavigationDrawer {...navigation} />
              <Link to="/" className="truncate font-display text-lg font-semibold">
                AZ Notes
              </Link>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <AdminThemeToggle />
              <AdminAccount admin={admin} onLogout={onLogout} showIdentity={false} />
            </div>
          </header>
          <div
            id="admin-content"
            className={
              section === "assistant"
                ? "mx-auto flex min-h-0 w-full max-w-[1440px] flex-1 flex-col p-4 sm:px-6 lg:p-8"
                : "mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:p-8"
            }
            tabIndex={-1}
          >
            <header
              className={
                section === "assistant"
                  ? "mb-3 shrink-0 border-b border-border pb-3"
                  : "mb-7 border-b border-border pb-6"
              }
            >
              <p
                className={
                  section === "assistant" ? "hidden" : "mb-2 text-xs text-muted-foreground"
                }
              >
                内容工作台{section === "articles" ? " / 创作" : ""}
              </p>
              <h1 className="text-2xl/tight font-semibold tracking-tight lg:text-3xl">
                {sectionMeta.title}
              </h1>
              <p className="mt-2 max-w-2xl text-sm/6 text-muted-foreground">
                {sectionMeta.description}
              </p>
            </header>
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </main>
  );
}
function Brand() {
  return (
    <Link
      to="/"
      className="flex min-w-0 items-center gap-2.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
        AZ
      </span>
      <span className="min-w-0">
        <span className="block truncate font-display text-lg font-semibold">AZ Notes</span>
        <span className="block text-xs text-muted-foreground">内容工作台</span>
      </span>
    </Link>
  );
}
export { AdminShell };
export type { AdminSectionKey } from "./types";
