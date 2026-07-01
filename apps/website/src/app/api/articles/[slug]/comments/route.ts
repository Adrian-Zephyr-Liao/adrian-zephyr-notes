import { NextRequest, NextResponse } from "next/server";
import { copySetCookieHeaders, getBackendApiBaseUrl } from "@/lib/backend-api";

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  return proxyComments(request, slug);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  return proxyComments(request, slug, await request.text());
}

async function proxyComments(request: NextRequest, slug: string, body?: string) {
  const url = new URL(
    `${getBackendApiBaseUrl()}/api/articles/${encodeURIComponent(slug)}/comments`,
  );

  for (const [key, value] of request.nextUrl.searchParams) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
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
