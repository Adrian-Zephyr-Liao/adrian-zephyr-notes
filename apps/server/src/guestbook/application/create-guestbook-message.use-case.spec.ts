import { describe, expect, it, vi } from "vitest";
import type { GuestbookMessageRepository } from "../domain/guestbook-message.repository";
import {
  GUESTBOOK_MESSAGE_BODY_MAX_LENGTH,
  GUESTBOOK_NICKNAME_MAX_LENGTH,
  GuestbookMessageBodyEmptyError,
  GuestbookMessageBodyTooLongError,
  GuestbookNicknameRequiredError,
  GuestbookNicknameTooLongError,
} from "../domain/guestbook-message.entity";
import {
  GuestbookMessageRateLimitedError,
  GuestbookMessageRejectedAsSpamError,
} from "./guestbook-message.errors";
import { CreateGuestbookMessageUseCase } from "./create-guestbook-message.use-case";

describe("CreateGuestbookMessageUseCase", () => {
  it("creates GitHub user messages without requiring a guest nickname", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await useCase.execute({
      body: "  很喜欢这个站点  ",
      guestFingerprint: "fingerprint-1",
      user: { id: "7d569d22-8f0d-4283-b56c-786cc4770d0e" },
    });

    expect(repository.create).toHaveBeenCalledWith({
      authorUserId: "7d569d22-8f0d-4283-b56c-786cc4770d0e",
      guestNickname: null,
      guestFingerprint: null,
      body: "很喜欢这个站点",
    });
  });

  it("creates anonymous messages with a trimmed nickname", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await useCase.execute({
      body: "hello",
      guestNickname: "  路过的人  ",
      guestFingerprint: "fingerprint-1",
      user: null,
    });

    expect(repository.create).toHaveBeenCalledWith({
      authorUserId: null,
      guestNickname: "路过的人",
      guestFingerprint: "fingerprint-1",
      body: "hello",
    });
  });

  it("rejects anonymous messages without a nickname", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        body: "hello",
        guestFingerprint: "fingerprint-1",
        user: null,
      }),
    ).rejects.toBeInstanceOf(GuestbookNicknameRequiredError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects overly long anonymous nicknames", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        body: "hello",
        guestNickname: "a".repeat(GUESTBOOK_NICKNAME_MAX_LENGTH + 1),
        guestFingerprint: "fingerprint-1",
        user: null,
      }),
    ).rejects.toBeInstanceOf(GuestbookNicknameTooLongError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects empty message bodies", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        body: "   ",
        guestNickname: "匿名",
        guestFingerprint: "fingerprint-1",
        user: null,
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageBodyEmptyError);
  });

  it("rejects overly long message bodies", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        body: "a".repeat(GUESTBOOK_MESSAGE_BODY_MAX_LENGTH + 1),
        guestNickname: "匿名",
        guestFingerprint: "fingerprint-1",
        user: null,
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageBodyTooLongError);
  });

  it("rejects honeypot submissions", async () => {
    const repository = createRepositoryDouble();
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        body: "hello",
        guestNickname: "匿名",
        guestFingerprint: "fingerprint-1",
        honeypot: "https://spam.example",
        user: null,
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageRejectedAsSpamError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rate limits anonymous messages by fingerprint", async () => {
    const repository = createRepositoryDouble();
    repository.countRecentAnonymousMessages.mockResolvedValue(3);
    const useCase = new CreateGuestbookMessageUseCase(repository);

    await expect(
      useCase.execute({
        body: "hello",
        guestNickname: "匿名",
        guestFingerprint: "fingerprint-1",
        user: null,
        now: new Date("2026-07-02T12:00:00.000Z"),
      }),
    ).rejects.toBeInstanceOf(GuestbookMessageRateLimitedError);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

function createRepositoryDouble() {
  return {
    countRecentAnonymousMessages: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    listVisible: vi.fn(),
  } as unknown as GuestbookMessageRepository & {
    countRecentAnonymousMessages: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}
