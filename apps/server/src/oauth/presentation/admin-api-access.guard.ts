import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import type { AdminRequest } from "../../auth/presentation/current-admin.decorator";
import { OAuthService } from "../application/oauth.service";
import { OAuthError, type OAuthScope } from "../domain/oauth";
import { bearerHttpError, bearerToken, noStore } from "./oauth-http";

type AdminApiPolicy = {
  anyOf?: OAuthScope[];
  allOf?: OAuthScope[];
  optionalCookie?: boolean;
};
const ADMIN_API_POLICY = Symbol("ADMIN_API_POLICY");

function AdminApiAccess(policy: OAuthScope | AdminApiPolicy) {
  return SetMetadata(ADMIN_API_POLICY, typeof policy === "string" ? { allOf: [policy] } : policy);
}

@Injectable()
class AdminApiAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminAuth: AdminAuthGuard,
    private readonly oauth: OAuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const policy = this.reflector.getAllAndOverride<AdminApiPolicy>(ADMIN_API_POLICY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (request.headers.authorization === undefined) {
      if (policy?.optionalCookie) return true;
      return this.adminAuth.canActivate(context);
    }
    const response = context.switchToHttp().getResponse<Response>();
    noStore(response);
    try {
      const token = await this.oauth.authenticate(bearerToken(request));
      const scopes = token.scope.split(" ");
      if (
        !policy ||
        (!policy.anyOf?.length && !policy.allOf?.length) ||
        (policy.anyOf && !policy.anyOf.some((scope) => scopes.includes(scope))) ||
        (policy.allOf && !policy.allOf.every((scope) => scopes.includes(scope)))
      ) {
        throw new OAuthError("insufficient_scope", "The token does not grant this operation.");
      }
      request.currentAdmin = token.user;
      return true;
    } catch (error) {
      throw bearerHttpError(error, response);
    }
  }
}

export { AdminApiAccess, AdminApiAccessGuard };
