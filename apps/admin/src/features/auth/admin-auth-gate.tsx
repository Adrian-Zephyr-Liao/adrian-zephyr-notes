import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { Github, Loader2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AdminThemeToggle } from "../../components/admin/admin-theme-toggle";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
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
  return (
    <main className="relative grid min-h-dvh place-items-center bg-background p-6">
      <div className="absolute top-4 right-4">
        <AdminThemeToggle />
      </div>
      <Card className="w-full max-w-md border-border bg-card">
        <CardContent className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground">
              AZ
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold">AZ Notes Studio</h1>
              <p className="text-sm text-muted-foreground">使用 GitHub 白名单进入内容工作台。</p>
            </div>
          </div>
          <Button asChild className="w-full" size="lg">
            <a href={getAdminLoginUrl(returnTo)}>
              <Github />
              使用 GitHub 登录
            </a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function AdminFullPageStatus({ title }: { title: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-background p-6">
      <div className="absolute top-4 right-4">
        <AdminThemeToggle />
      </div>
      <Card className="w-full max-w-sm border-border bg-card">
        <CardContent className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">正在准备内容工作台</p>
          </div>
          <Loader2 className="ml-auto size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
        </CardContent>
      </Card>
    </main>
  );
}

export { AdminAuthGate, AdminFullPageStatus };
