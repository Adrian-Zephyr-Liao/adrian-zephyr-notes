import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backend-api";

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
  return proxyBackendRequest(request, {
    body,
    path: `/api/articles/${encodeURIComponent(slug)}/comments`,
  });
}
