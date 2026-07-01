import type { AuthUser, GithubUserProfile } from "./auth-user.entity";

interface AuthUserRepository {
  upsertGithubUser(profile: GithubUserProfile): Promise<AuthUser>;
}

const AUTH_USER_REPOSITORY = Symbol("AUTH_USER_REPOSITORY");

export { AUTH_USER_REPOSITORY, type AuthUserRepository };
