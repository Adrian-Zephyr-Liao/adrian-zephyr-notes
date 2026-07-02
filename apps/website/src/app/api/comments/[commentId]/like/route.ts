import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backend-api";

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
  return proxyBackendRequest(request, {
    method,
    path: `/api/comments/${encodeURIComponent(commentId)}/like`,
  });
}
