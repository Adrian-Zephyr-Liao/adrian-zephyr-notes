import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { GetCurrentAdminUseCase } from "../application/get-current-admin.use-case";
import { getSessionTokenFromRequest } from "./request-session";
import type { AdminRequest } from "./current-admin.decorator";

@Injectable()
class AdminAuthGuard implements CanActivate {
  constructor(private readonly getCurrentAdmin: GetCurrentAdminUseCase) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const admin = await this.getCurrentAdmin.execute(getSessionTokenFromRequest(request));

    if (!admin) {
      throw new UnauthorizedException({
        error: {
          code: "ADMIN_AUTH_REQUIRED",
          message: "Admin access is required",
        },
      });
    }

    request.currentAdmin = admin;
    return true;
  }
}

export { AdminAuthGuard };
