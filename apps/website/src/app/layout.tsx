import type { Metadata } from "next";
import { Suspense } from "react";
import { PageScrollControls } from "@/components/site/page-scroll-controls";
import { RouteTransitionProgress } from "@/components/site/route-transition-progress";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { ThemeProvider } from "@/components/site/theme-provider";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  openGraph: {
    title: site.title,
    description: site.description,
  },
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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="relative z-10 flex min-h-screen flex-col">
            <a
              className="fixed -top-20 left-6 z-100 rounded-[0.65rem] bg-primary px-[1.2rem] py-[0.8rem] text-primary-foreground focus:top-4"
              href="#page-content"
            >
              跳到主要内容
            </a>
            <Suspense fallback={null}>
              <RouteTransitionProgress />
            </Suspense>
            <SiteHeader />
            <div id="page-content" tabIndex={-1} />
            {children}
            <SiteFooter />
            <PageScrollControls />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
