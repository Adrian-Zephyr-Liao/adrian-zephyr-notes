import type { Request } from "express";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import type {
  AdminOperationActor,
  AdminOperationRequestContext,
} from "../domain/admin-operation-log";

function toAdminOperationActor(admin: AuthUser): AdminOperationActor {
  return {
    id: admin.id,
    login: admin.login,
  };
}

function toAdminOperationRequestContext(request: Request): AdminOperationRequestContext {
  return {
    ipAddress: getRequestIpAddress(request),
    userAgent: request.get("user-agent") ?? null,
  };
}

function getRequestIpAddress(request: Request) {
  const forwardedFor = request.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.ip || null;
}

export { toAdminOperationActor, toAdminOperationRequestContext };
