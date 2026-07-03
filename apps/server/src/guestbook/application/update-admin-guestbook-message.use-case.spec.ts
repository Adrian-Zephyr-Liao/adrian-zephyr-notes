import { describe, expect, it, vi } from "vitest";
import type { AdminGuestbookMessageRepository } from "../domain/admin-guestbook-message.repository";
import {
  AdminGuestbookMessageNotFoundError,
  AdminGuestbookMessageValidationError,
} from "./admin-guestbook-message.errors";
import {
  UpdateAdminGuestbookMessageUseCase,
  normalizeUpdateAdminGuestbookMessageInput,
} from "./update-admin-guestbook-message.use-case";

describe("UpdateAdminGuestbookMessageUseCase", () => {
  it("updates status and pin state", async () => {
    const now = new Date("2026-07-03T02:10:00.000Z");
    const repository = createRepositoryDouble();
    const useCase = new UpdateAdminGuestbookMessageUseCase(repository);

    await useCase.execute(
      {
        id: "message-1",
        isPinned: true,
        status: "HIDDEN",
      },
      now,
    );

    expect(repository.update).toHaveBeenCalledWith({
      id: "message-1",
      isPinned: true,
      pinnedAt: now,
      status: "HIDDEN",
    });
  });

  it("throws when the message does not exist", async () => {
    const repository = createRepositoryDouble();
    repository.update.mockResolvedValue(null);
    const useCase = new UpdateAdminGuestbookMessageUseCase(repository);

    await expect(useCase.execute({ id: "missing", status: "VISIBLE" })).rejects.toBeInstanceOf(
      AdminGuestbookMessageNotFoundError,
    );
  });
});

describe("normalizeUpdateAdminGuestbookMessageInput", () => {
  it("clears pinnedAt when unpinning", () => {
    expect(
      normalizeUpdateAdminGuestbookMessageInput(
        {
          id: "message-1",
          isPinned: false,
        },
        new Date("2026-07-03T02:10:00.000Z"),
      ),
    ).toEqual({
      id: "message-1",
      isPinned: false,
      pinnedAt: null,
    });
  });

  it("rejects empty updates", () => {
    expect(() =>
      normalizeUpdateAdminGuestbookMessageInput(
        {
          id: "message-1",
        },
        new Date("2026-07-03T02:10:00.000Z"),
      ),
    ).toThrow(AdminGuestbookMessageValidationError);
  });

  it("rejects unsupported statuses", () => {
    expect(() =>
      normalizeUpdateAdminGuestbookMessageInput(
        {
          id: "message-1",
          status: "SPAM",
        },
        new Date("2026-07-03T02:10:00.000Z"),
      ),
    ).toThrow(AdminGuestbookMessageValidationError);
  });
});

function createRepositoryDouble() {
  return {
    list: vi.fn(),
    update: vi.fn().mockResolvedValue({
      author: {
        avatarSeed: "message-1",
        nickname: "访客",
        type: "GUEST",
      },
      body: "hello",
      createdAt: new Date("2026-07-03T02:00:00.000Z"),
      guestFingerprint: "fingerprint",
      id: "message-1",
      isPinned: true,
      likeCount: 0,
      pinnedAt: new Date("2026-07-03T02:10:00.000Z"),
      status: "HIDDEN",
      updatedAt: new Date("2026-07-03T02:10:00.000Z"),
    }),
  } as unknown as AdminGuestbookMessageRepository & {
    update: ReturnType<typeof vi.fn>;
  };
}
