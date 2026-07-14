import * as React from "react";
import { Slot } from "radix-ui";
import { cn } from "../../lib/utils";

function SidebarProvider({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-provider"
      style={
        {
          "--sidebar-width": "16rem",
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
        "sticky top-0 z-30 border-b border-border/45 bg-(--glass-surface-strong) p-3 shadow-sm backdrop-blur-xl lg:top-0 lg:h-dvh lg:border-b-0 lg:p-4 lg:shadow-(--shadow-sidebar)",
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
        "scrollbar-none mt-3 flex min-h-0 gap-2 overflow-x-auto pb-1 lg:mt-6 lg:grid lg:gap-5 lg:overflow-x-visible lg:overflow-y-auto lg:pb-0",
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
        "mt-5 hidden rounded-2xl border border-white/45 bg-background/45 p-2.5 shadow-sm backdrop-blur-md lg:block dark:border-white/8 dark:bg-white/5",
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
        "hidden px-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground/85 uppercase lg:block",
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
        "flex w-auto cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-left text-sm text-muted-foreground transition-[background-color,color,box-shadow,scale] duration-150 ease-(--ease-out-ui) outline-none hover:bg-background/55 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100 lg:w-full lg:rounded-xl lg:px-2.5 motion-reduce:transition-none motion-reduce:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0",
        isActive && "bg-background/72 text-foreground shadow-sm dark:bg-white/9",
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
      className={cn("min-w-0 bg-background/20", className)}
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
