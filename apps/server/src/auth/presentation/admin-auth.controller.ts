import { Controller, Get, Req } from "@nestjs/common";
import type { AdminMeResponse } from "@adrian-zephyr-notes/contracts";
import type { Request } from "express";
import { GetCurrentAdminUseCase } from "../application/get-current-admin.use-case";
import { toAdminUserResponse } from "../infrastructure/auth-user.mapper";
import { getSessionTokenFromRequest } from "./request-session";

@Controller("api/admin/auth")
class AdminAuthController {
  constructor(private readonly getCurrentAdmin: GetCurrentAdminUseCase) {}

  @Get("me")
  async me(@Req() request: Request): Promise<AdminMeResponse> {
    const user = await this.getCurrentAdmin.execute(getSessionTokenFromRequest(request));

    return {
      user: user ? toAdminUserResponse(user) : null,
    };
  }
}

export { AdminAuthController };
