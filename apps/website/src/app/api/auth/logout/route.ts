import { NextRequest } from "next/server";
import { proxyBackendRequest } from "@/lib/backend-api";

export async function POST(request: NextRequest) {
  return proxyBackendRequest(request, {
    method: "POST",
    path: "/api/auth/logout",
    responseBody: "empty",
  });
}
