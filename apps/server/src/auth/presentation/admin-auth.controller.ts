import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { AdminMeResponse } from "@adrian-zephyr-notes/contracts";
import { GetCurrentAdminUseCase } from "../application/get-current-admin.use-case";
import { toAdminUserResponse } from "../infrastructure/auth-user.mapper";
import { getSessionTokenFromRequest } from "./request-session";
import type { AdminRequest } from "./current-admin.decorator";
import { OAUTH_SCOPES } from "../../oauth/domain/oauth";
import {
  AdminApiAccess,
  AdminApiAccessGuard,
} from "../../oauth/presentation/admin-api-access.guard";

@Controller("api/admin/auth")
@UseGuards(AdminApiAccessGuard)
class AdminAuthController {
  constructor(private readonly getCurrentAdmin: GetCurrentAdminUseCase) {}

  @Get("me")
  @AdminApiAccess({ anyOf: [...OAUTH_SCOPES], optionalCookie: true })
  async me(@Req() request: AdminRequest): Promise<AdminMeResponse> {
    const user =
      request.headers.authorization !== undefined
        ? (request.currentAdmin ?? null)
        : await this.getCurrentAdmin.execute(getSessionTokenFromRequest(request));

    return {
      user: user ? toAdminUserResponse(user) : null,
    };
  }
}

export { AdminAuthController };
