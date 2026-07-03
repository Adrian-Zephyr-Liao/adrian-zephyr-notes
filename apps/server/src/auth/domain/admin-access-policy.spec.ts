import { describe, expect, it } from "vitest";
import { AdminAccessPolicy } from "./admin-access-policy";
import type { AuthUser } from "./auth-user.entity";

describe("AdminAccessPolicy", () => {
  it("denies access when no admin login is configured", () => {
    const policy = new AdminAccessPolicy(undefined);

    expect(policy.canAccess(createUser("Adrian-Zephyr-Liao"))).toBe(false);
  });

  it("allows configured GitHub logins case-insensitively", () => {
    const policy = new AdminAccessPolicy("octo, Adrian-Zephyr-Liao ");

    expect(policy.canAccess(createUser("adrian-zephyr-liao"))).toBe(true);
  });

  it("denies anonymous users and users outside the allowlist", () => {
    const policy = new AdminAccessPolicy("Adrian-Zephyr-Liao");

    expect(policy.canAccess(null)).toBe(false);
    expect(policy.canAccess(createUser("someone-else"))).toBe(false);
  });
});

function createUser(login: string): AuthUser {
  return {
    id: `${login}-id`,
    githubId: `${login}-github`,
    login,
    name: login,
    avatarUrl: null,
    profileUrl: `https://github.com/${login}`,
  };
}
