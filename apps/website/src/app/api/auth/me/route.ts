import { NextRequest, NextResponse } from "next/server";
import { copySetCookieHeaders, getBackendApiBaseUrl } from "@/lib/backend-api";

export async function GET(request: NextRequest) {
  const response = await fetch(`${getBackendApiBaseUrl()}/api/auth/me`, {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
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
