import type { Request } from "express";
import { GetCurrentUserUseCase } from "../application/get-current-user.use-case";
import { SESSION_COOKIE_NAME, parseCookies } from "./cookie";

function getSessionTokenFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.cookie);
  return cookies[SESSION_COOKIE_NAME];
}

function getCurrentUserFromRequest(request: Request, getCurrentUser: GetCurrentUserUseCase) {
  return getCurrentUser.execute(getSessionTokenFromRequest(request));
}

export { getCurrentUserFromRequest, getSessionTokenFromRequest };
