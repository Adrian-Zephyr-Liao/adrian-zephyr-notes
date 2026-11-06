import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import type { AdminRequest } from "../../auth/presentation/current-admin.decorator";
import { OAuthService } from "../application/oauth.service";
import { OAuthError } from "../domain/oauth";
import { bearerHttpError, bearerToken, noStore } from "./oauth-http";

@Injectable()
class ArticleAccessGuard implements CanActivate {
  constructor(
    private readonly adminAuth: AdminAuthGuard,
    private readonly oauth: OAuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (request.headers.authorization === undefined) return this.adminAuth.canActivate(context);
    const response = context.switchToHttp().getResponse<Response>();
    noStore(response);
    try {
      const token = await this.oauth.authenticate(bearerToken(request));
      const scope = ["GET", "HEAD"].includes(request.method)
        ? "articles:read"
        : ["POST", "PATCH"].includes(request.method)
          ? "articles:write"
          : null;
      if (!scope || !token.scope.split(" ").includes(scope)) {
        throw new OAuthError("insufficient_scope", "The token does not grant this operation.");
      }
      request.currentAdmin = token.user;
      return true;
    } catch (error) {
      throw bearerHttpError(error, response);
    }
  }
}

export { ArticleAccessGuard };
