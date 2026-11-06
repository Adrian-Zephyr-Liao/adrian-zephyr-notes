import type { Metadata } from "next";
import { Suspense } from "react";
import { PageScrollControls } from "@/components/site/page-scroll-controls";
import { RouteTransitionProgress } from "@/components/site/route-transition-progress";
import { SiteHeader } from "@/components/site/site-header";
import { ThemeProvider } from "@/components/site/theme-provider";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  alternates: {
    types: { "application/rss+xml": "/rss.xml" },
  },
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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="relative z-10 flex min-h-screen flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
            <Suspense fallback={null}>
              <RouteTransitionProgress />
            </Suspense>
            <SiteHeader />
            {children}
            <PageScrollControls />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
