import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backend-api";

type RouteContext = {
  params: Promise<{
    messageId: string;
  }>;
};

export async function PUT(request: NextRequest, context: RouteContext) {
  const { messageId } = await context.params;
  return proxyGuestbookMessageLike(request, messageId, "PUT");
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { messageId } = await context.params;
  return proxyGuestbookMessageLike(request, messageId, "DELETE");
}

async function proxyGuestbookMessageLike(
  request: NextRequest,
  messageId: string,
  method: "DELETE" | "PUT",
) {
  return proxyBackendRequest(request, {
    method,
    path: `/api/guestbook/messages/${encodeURIComponent(messageId)}/like`,
  });
}
