import type { Metadata } from "next";
import { RouteTransitionProgress } from "@/components/site/route-transition-progress";
import { SiteHeader } from "@/components/site/site-header";
import { ThemeProvider } from "@/components/site/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adrian Zephyr Notes",
  description: "A personal blog for notes, essays, and experiments.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <div
          aria-hidden="true"
          className="site-viewport-background pointer-events-none fixed inset-0 z-0"
        />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="relative z-10 flex min-h-screen flex-col">
            <RouteTransitionProgress />
            <SiteHeader />
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
