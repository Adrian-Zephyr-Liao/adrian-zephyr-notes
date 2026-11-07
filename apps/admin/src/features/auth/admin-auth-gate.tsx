import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { ArrowRight, ArrowUpRight, Code2, Github, Info, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AdminThemeToggle } from "../../components/admin/admin-theme-toggle";
import { Button } from "../../components/ui/button";
import { getAdminLoginUrl, getCurrentAdmin } from "../../lib/admin-api";

type AdminAuthGateProps = {
  children: (admin: AdminUserResponse, onLogout: () => void) => ReactNode;
  returnTo?: string;
};

function AdminAuthGate({ children, returnTo = "/" }: AdminAuthGateProps) {
  const [admin, setAdmin] = useState<AdminUserResponse | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    void getCurrentAdmin()
      .then((response) => setAdmin(response.user))
      .catch(() => setAdmin(null))
      .finally(() => setAuthReady(true));
  }, []);

  if (!authReady) {
    return <AdminFullPageStatus title="正在确认管理员身份" />;
  }

  if (!admin) {
    return <AdminLoginPage returnTo={returnTo} />;
  }

  return children(admin, () => setAdmin(null));
}

function AdminLoginPage({ returnTo }: { returnTo: string }) {
  const isDeviceAuthorization = returnTo.startsWith("/oauth/device");

  return (
    <main className="grid min-h-dvh bg-background text-foreground lg:grid-cols-[48%_52%]">
      <aside
        className="relative hidden min-h-dvh overflow-hidden bg-muted lg:block"
        aria-label="数字编辑室"
      >
        <img
          alt=""
          className="absolute inset-0 size-full object-cover"
          src="/images/editorial-stairway.webp"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-black/5 to-transparent" />
        <div className="absolute inset-x-10 bottom-12 text-[#fffefa] xl:left-14">
          <p className="font-display text-4xl font-semibold tracking-tight xl:text-5xl">AZ Notes</p>
          <p className="mt-3 font-display text-2xl/relaxed xl:text-3xl/relaxed">与时间保持联系。</p>
          <p className="mt-3 font-display text-[11px] tracking-[0.2em]">
            THE DIGITAL EDITORIAL ROOM
          </p>
        </div>
      </aside>
      <section className="flex min-h-dvh min-w-0 flex-col px-6 pt-6 pb-8 sm:px-10 lg:px-12 xl:px-16">
        <header className="flex items-center justify-between gap-4">
          <a
            className="inline-flex items-center gap-2 rounded-sm text-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            href="https://zephyrai.site"
          >
            返回博客 <ArrowUpRight className="size-4" aria-hidden="true" />
          </a>
          <div className="flex items-center gap-5">
            <span className="hidden font-display text-xs tracking-[0.2em] text-muted-foreground sm:inline">
              FOLIO 08
            </span>
            <span className="border-l border-border pl-4">
              <AdminThemeToggle />
            </span>
          </div>
        </header>
        <div className="flex flex-1 flex-col justify-center py-14 sm:py-20">
          <p className="mb-12 font-display text-3xl font-semibold lg:hidden">AZ Notes</p>
          <span className="mb-6 h-0.5 w-14 bg-primary" aria-hidden="true" />
          <p className="font-display text-base tracking-wide text-primary xl:text-lg">
            个人出版与编辑工作室
          </p>
          <h1 className="mt-7 font-display text-4xl/tight font-semibold tracking-tight text-balance sm:text-5xl/tight xl:text-6xl/tight">
            {isDeviceAuthorization ? "连接你的工作台。" : "继续你的记录。"}
          </h1>
          <p className="mt-5 font-display text-base/8 text-muted-foreground sm:text-lg/8 xl:text-xl/9">
            {isDeviceAuthorization
              ? "使用管理员账号登录，继续核对设备授权码。"
              : "整理想法，发布文章，与读者保持联系。"}
          </p>
          <div className="mt-10 sm:mt-12">
            <Button
              asChild
              className="h-14 w-full justify-start px-5 font-display text-lg [&_svg]:size-5"
              size="lg"
            >
              <a href={getAdminLoginUrl(returnTo)}>
                <Github aria-hidden="true" />
                使用 GitHub 登录
                <ArrowRight className="ml-auto" aria-hidden="true" />
              </a>
            </Button>
            <a
              className="mt-6 inline-flex items-center gap-3 rounded-sm font-display text-base underline decoration-border underline-offset-4 transition-colors outline-none hover:text-primary hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
              href={isDeviceAuthorization ? "/" : getAdminLoginUrl("/oauth/device")}
            >
              <Code2 className="size-5" aria-hidden="true" />
              {isDeviceAuthorization ? "返回内容工作台" : "输入设备授权码"}
            </a>
            <p className="mt-8 flex items-start gap-2.5 text-xs/6 text-muted-foreground sm:text-sm/6">
              <Info className="mt-1 size-4 shrink-0" aria-hidden="true" />
              仅授权的管理员可进入工作室。
            </p>
          </div>
        </div>
        <footer className="border-t border-border pt-6 font-display text-[11px] tracking-[0.14em] text-muted-foreground sm:text-xs">
          AZ Notes Studio · Private workspace
        </footer>
      </section>
    </main>
  );
}

function AdminFullPageStatus({ title }: { title: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-background px-6 py-16">
      <div className="absolute top-6 right-6">
        <AdminThemeToggle />
      </div>
      <section className="w-full max-w-sm border-y border-border py-7" role="status">
        <p className="mb-6 font-display text-2xl font-semibold">AZ Notes</p>
        <div className="flex items-center gap-3">
          <Loader2
            className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
            aria-hidden="true"
          />
          <div>
            <h1 className="text-sm font-medium">{title}</h1>
            <p className="mt-1 text-xs/6 text-muted-foreground">正在准备内容工作台</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export { AdminAuthGate, AdminFullPageStatus };
