import type { AdminUserResponse, AuthUserResponse } from "@adrian-zephyr-notes/contracts";
import type { AuthUser } from "../domain/auth-user.entity";

function toAuthUserResponse(user: AuthUser): AuthUserResponse {
  return {
    id: user.id,
    githubId: user.githubId,
    login: user.login,
    name: user.name,
    avatarUrl: user.avatarUrl,
    profileUrl: user.profileUrl,
  };
}

function toAdminUserResponse(user: AuthUser): AdminUserResponse {
  return {
    ...toAuthUserResponse(user),
    role: "ADMIN",
  };
}

export { toAdminUserResponse, toAuthUserResponse };
