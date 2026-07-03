import type { AuthUser } from "./auth-user.entity";

class AdminAccessPolicy {
  private readonly allowedLogins: ReadonlySet<string>;

  constructor(rawAllowedLogins: string | undefined) {
    this.allowedLogins = new Set(
      (rawAllowedLogins ?? "")
        .split(",")
        .map((login) => login.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  canAccess(user: AuthUser | null) {
    return Boolean(user && this.allowedLogins.has(user.login.toLowerCase()));
  }
}

export { AdminAccessPolicy };
