import { NextRequest, NextResponse } from "next/server";
import { copySetCookieHeaders, getBackendApiBaseUrl } from "@/lib/backend-api";

type RouteContext = {
  params: Promise<{
    commentId: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const { commentId } = await context.params;
  return proxyCommentLike(request, commentId, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { commentId } = await context.params;
  return proxyCommentLike(request, commentId, "DELETE");
}

async function proxyCommentLike(request: NextRequest, commentId: string, method: "DELETE" | "PUT") {
  const response = await fetch(
    `${getBackendApiBaseUrl()}/api/comments/${encodeURIComponent(commentId)}/like`,
    {
      method,
      headers: {
        cookie: request.headers.get("cookie") ?? "",
      },
      cache: "no-store",
    },
  );
  const headers = new Headers({
    "content-type": response.headers.get("content-type") ?? "application/json",
  });

  copySetCookieHeaders(response, headers);

  return new NextResponse(await response.text(), {
    status: response.status,
    headers,
  });
}
