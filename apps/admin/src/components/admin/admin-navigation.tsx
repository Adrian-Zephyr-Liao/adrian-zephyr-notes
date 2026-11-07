import { Link } from "@tanstack/react-router";
import { Dialog } from "radix-ui";
import { FileText, FolderTree, Menu, Tags, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { createAdminNavGroups } from "./data";
import type { AdminSectionKey, AdminShellProps } from "./types";

type NavigationProps = {
  section: AdminSectionKey;
  articlePage?: AdminShellProps["articlePage"];
  assistantEnabled: boolean;
  onNavigate?: () => void;
};
function AdminNavigation({ section, articlePage, assistantEnabled, onNavigate }: NavigationProps) {
  return (
    <nav aria-label="管理导航" className="grid content-start gap-7">
      {createAdminNavGroups(assistantEnabled).map((group) => (
        <div className="grid gap-2" key={group.label}>
          <p className="px-3 text-xs text-muted-foreground">{group.label}</p>
          <ul className="grid gap-1">
            {group.items.map((item) => (
              <li key={item.key}>
                <Link
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    section === item.key && "bg-accent font-semibold text-accent-foreground",
                  )}
                  to={item.to}
                  onClick={onNavigate}
                  aria-current={
                    section === item.key && !(item.key === "articles" && articlePage)
                      ? "page"
                      : undefined
                  }
                >
                  <item.icon className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
                {item.key === "articles" && section === "articles" ? (
                  <ul className="mt-1 ml-5 grid gap-1 border-l border-border pl-3">
                    {(
                      [
                        { page: "list", label: "文章列表", to: "/articles", icon: FileText },
                        {
                          page: "categories",
                          label: "分类管理",
                          to: "/articles/categories",
                          icon: FolderTree,
                        },
                        { page: "tags", label: "标签管理", to: "/articles/tags", icon: Tags },
                      ] as const
                    ).map((child) => (
                      <li key={child.page}>
                        <Link
                          className={cn(
                            "flex min-h-10 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                            articlePage === child.page && "font-semibold text-primary",
                          )}
                          to={child.to}
                          aria-current={articlePage === child.page ? "page" : undefined}
                          onClick={onNavigate}
                        >
                          <child.icon className="size-3.5" />
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
function AdminNavigationDrawer(props: NavigationProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="打开管理导航">
          <Menu />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-80 max-w-[calc(100%-2.5rem)] flex-col gap-7 overflow-y-auto border-r border-border bg-background p-5 shadow-(--shadow-glass-strong) outline-none">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-xl font-semibold">内容工作台</Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="关闭管理导航">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            选择管理页面；按 Escape 关闭并回到导航按钮。
          </Dialog.Description>
          <AdminNavigation {...props} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export { AdminNavigation, AdminNavigationDrawer };
