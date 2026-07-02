import { NextRequest, NextResponse } from "next/server";
import { copySetCookieHeaders, getBackendApiBaseUrl } from "@/lib/backend-api";

export async function GET(request: NextRequest) {
  return proxyGuestbookMessages(request);
}

export async function POST(request: NextRequest) {
  return proxyGuestbookMessages(request, await request.text());
}

async function proxyGuestbookMessages(request: NextRequest, body?: string) {
  const url = new URL(`${getBackendApiBaseUrl()}/api/guestbook/messages`);

  for (const [key, value] of request.nextUrl.searchParams) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
      "user-agent": request.headers.get("user-agent") ?? "",
      "x-forwarded-for":
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        request.headers.get("cf-connecting-ip") ??
        "",
    },
    body,
    cache: "no-store",
  });
  const headers = new Headers({
    "content-type": response.headers.get("content-type") ?? "application/json",
  });

  copySetCookieHeaders(response, headers);

  return new NextResponse(await response.text(), {
    status: response.status,
    headers,
  });
}
