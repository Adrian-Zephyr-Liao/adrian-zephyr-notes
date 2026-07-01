import type { AuthUserResponse } from "@adrian-zephyr-notes/contracts";
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

export { toAuthUserResponse };
