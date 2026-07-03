import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "../domain/auth-user.entity";

type AdminRequest = Request & {
  currentAdmin?: AuthUser;
};

const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AdminRequest>();
  return request.currentAdmin ?? null;
});

export { CurrentAdmin, type AdminRequest };
