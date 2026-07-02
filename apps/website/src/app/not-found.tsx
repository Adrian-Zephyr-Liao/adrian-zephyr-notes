import Link from "next/link";
import { ArrowDown, Home } from "lucide-react";

import { StatusPage } from "@/components/status/status-page";
import { Button } from "@/components/ui/button";

function NotFound() {
  return (
    <StatusPage
      actions={
        <>
          <Button asChild>
            <Link href="/">
              <Home className="size-4" />
              返回首页
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/#articles">
              <ArrowDown className="size-4" />
              浏览文章列表
            </Link>
          </Button>
        </>
      }
      description="这个地址没有对应的文章或页面。你可以回到首页继续浏览最近整理的笔记。"
      eyebrow="404"
      title="这里没有找到内容"
      variant="not-found"
    />
  );
}

export default NotFound;
