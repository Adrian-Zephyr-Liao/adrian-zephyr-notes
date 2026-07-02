"use client";

import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";

import { StatusPage } from "@/components/status/status-page";
import { Button } from "@/components/ui/button";

function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <StatusPage
      actions={
        <>
          <Button type="button" onClick={reset}>
            <RotateCcw className="size-4" />
            重试
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="size-4" />
              返回首页
            </Link>
          </Button>
        </>
      }
      description="页面加载时遇到了临时问题。你可以重试一次，或者先回到首页继续阅读。"
      eyebrow="Error"
      title="页面暂时无法展示"
      variant="error"
    />
  );
}

export default ErrorPage;
