import type { Request } from "express";
import { describe, expect, it, vi } from "vitest";
import type { GetCurrentUserUseCase } from "../application/get-current-user.use-case";
import { getCurrentUserFromRequest, getSessionTokenFromRequest } from "./request-session";

describe("request session helpers", () => {
  it("reads the local session token from request cookies", () => {
    const request = createRequestDouble("theme=dark; azn_session=session-token");

    expect(getSessionTokenFromRequest(request)).toBe("session-token");
  });

  it("passes the local session token to the current user use case", async () => {
    const getCurrentUser = {
      execute: vi.fn().mockResolvedValue({ id: "user-1" }),
    } as unknown as GetCurrentUserUseCase & {
      execute: ReturnType<typeof vi.fn>;
    };

    await expect(
      getCurrentUserFromRequest(createRequestDouble("azn_session=session-token"), getCurrentUser),
    ).resolves.toEqual({ id: "user-1" });
    expect(getCurrentUser.execute).toHaveBeenCalledWith("session-token");
  });
});

function createRequestDouble(cookie: string) {
  return {
    headers: {
      cookie,
    },
  } as Request;
}
