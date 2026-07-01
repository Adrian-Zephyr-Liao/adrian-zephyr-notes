import { NextRequest, NextResponse } from "next/server";
import { copySetCookieHeaders, getBackendApiBaseUrl } from "@/lib/backend-api";

export async function POST(request: NextRequest) {
  const response = await fetch(`${getBackendApiBaseUrl()}/api/auth/logout`, {
    method: "POST",
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
  });
  const headers = new Headers();

  copySetCookieHeaders(response, headers);

  return new NextResponse(null, {
    status: response.status,
    headers,
  });
}
