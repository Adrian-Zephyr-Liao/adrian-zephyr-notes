import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backend-api";

export async function GET(request: NextRequest) {
  return proxyGuestbookMessages(request);
}

export async function POST(request: NextRequest) {
  return proxyGuestbookMessages(request, await request.text());
}

async function proxyGuestbookMessages(request: NextRequest, body?: string) {
  return proxyBackendRequest(request, {
    body,
    forwardClientHeaders: true,
    path: "/api/guestbook/messages",
  });
}
