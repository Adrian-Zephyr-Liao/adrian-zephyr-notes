import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "../../lib/utils";

function SidebarProvider({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-provider"
      style={
        {
          "--sidebar-width": "17.5rem",
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "grid min-h-dvh w-full grid-cols-1 bg-(--gradient-soft) text-foreground lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
        className,
      )}
      {...props}
    />
  );
}

function Sidebar({ className, ...props }: React.ComponentProps<"aside">) {
  return (
    <aside
      data-slot="sidebar"
      className={cn(
        "sticky top-0 z-30 border-b border-(--glass-border) bg-(--glass-surface-strong) p-3 shadow-(--shadow-glass) backdrop-blur-2xl dark:border-transparent lg:h-dvh lg:border-r lg:border-b-0 lg:p-5 lg:shadow-(--shadow-sidebar)",
        className,
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("shrink-0", className)} {...props} />;
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "scrollbar-none mt-3 flex min-h-0 gap-2 overflow-x-auto pb-1 lg:mt-8 lg:grid lg:gap-6 lg:overflow-x-visible lg:overflow-y-auto lg:pb-0",
        className,
      )}
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "mt-5 hidden rounded-lg border border-(--glass-border) bg-background/30 p-2.5 shadow-sm backdrop-blur-md dark:border-transparent lg:block",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("contents lg:grid lg:gap-2", className)}
      {...props}
    />
  );
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sidebar-group-label"
      className={cn(
        "hidden px-2 text-[11px] font-semibold text-muted-foreground/80 lg:block",
        className,
      )}
      {...props}
    />
  );
}

function SidebarGroupContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("contents lg:grid lg:gap-1", className)}
      {...props}
    />
  );
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex shrink-0 gap-2 lg:grid lg:gap-1", className)}
      {...props}
    />
  );
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" className={cn("min-w-0", className)} {...props} />;
}

function SidebarMenuButton({
  asChild = false,
  className,
  isActive,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean;
  isActive?: boolean;
}) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-active={isActive ? "true" : undefined}
      data-slot="sidebar-menu-button"
      className={cn(
        "flex min-h-10 w-auto cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-[background-color,border-color,color,box-shadow,scale] duration-200 ease-(--ease-out-ui) outline-none hover:bg-background/45 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/45 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 lg:w-full motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0",
        isActive &&
          "bg-primary/12 font-medium text-foreground dark:bg-white/6 dark:[&_svg]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function SidebarMenuBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-menu-badge"
      className={cn(
        "ml-auto rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SidebarInset({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="sidebar-inset"
      className={cn("min-w-0 bg-background/8", className)}
      {...props}
    />
  );
}

export {
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
};
