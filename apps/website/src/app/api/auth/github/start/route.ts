import { NextRequest } from "next/server";
import { getBackendApiBaseUrl, toProxyRedirectResponse } from "@/lib/backend-api";

export async function GET(request: NextRequest) {
  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/";
  const url = new URL(`${getBackendApiBaseUrl()}/api/auth/github/start`);

  url.searchParams.set("returnTo", returnTo);

  const response = await fetch(url, {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
    cache: "no-store",
    redirect: "manual",
  });

  return toProxyRedirectResponse(response);
}
