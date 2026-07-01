import { NextRequest } from "next/server";
import { getBackendApiBaseUrl, toProxyRedirectResponse } from "@/lib/backend-api";

export async function GET(request: NextRequest) {
  const url = new URL(`${getBackendApiBaseUrl()}/api/auth/github/callback`);

  for (const [key, value] of request.nextUrl.searchParams) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
    redirect: "manual",
  });

  return toProxyRedirectResponse(response);
}
