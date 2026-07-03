import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { Github } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
    <main className="grid min-h-screen place-items-center bg-(--gradient-soft) p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
              AZ
            </span>
            <div>
              <h1 className="text-xl font-semibold">AZ Notes Studio</h1>
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
    <main className="grid min-h-screen place-items-center bg-(--gradient-soft) p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 text-sm text-muted-foreground">{title}</CardContent>
      </Card>
    </main>
  );
}

export { AdminAuthGate, AdminFullPageStatus };
