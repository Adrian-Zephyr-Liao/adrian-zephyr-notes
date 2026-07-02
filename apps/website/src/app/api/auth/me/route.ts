import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backend-api";

export async function GET(request: NextRequest) {
  return proxyBackendRequest(request, {
    path: "/api/auth/me",
  });
}
