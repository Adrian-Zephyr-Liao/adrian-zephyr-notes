import { NextRequest, NextResponse } from "next/server";
import { copySetCookieHeaders, getBackendApiBaseUrl } from "@/lib/backend-api";

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
  const response = await fetch(
    `${getBackendApiBaseUrl()}/api/guestbook/messages/${encodeURIComponent(messageId)}/like`,
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
