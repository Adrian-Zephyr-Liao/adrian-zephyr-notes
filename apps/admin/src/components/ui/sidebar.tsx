import * as React from "react";
import { cn } from "../../lib/utils";

function SidebarProvider({ className, style, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-provider"
      style={
        {
          "--sidebar-width": "15rem",
          ...style,
        } as React.CSSProperties
      }
      className={cn(
        "grid min-h-dvh w-full grid-cols-1 bg-background text-foreground lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
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
        "sticky top-0 z-30 hidden h-dvh flex-col border-r border-border bg-background p-5 lg:flex",
        className,
      )}
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("shrink-0", className)} {...props} />;
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("mt-auto border-t border-border pt-5", className)}
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

export { Sidebar, SidebarFooter, SidebarHeader, SidebarInset, SidebarProvider };
