import { describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { GetCurrentUserUseCase } from "../../auth/application/get-current-user.use-case";
import { CreateGuestbookMessageUseCase } from "../application/create-guestbook-message.use-case";
import { GuestbookMessageRateLimitedError } from "../application/guestbook-message.errors";
import { ListVisibleGuestbookMessagesUseCase } from "../application/list-visible-guestbook-messages.use-case";
import { GuestbookMessageBodyEmptyError } from "../domain/guestbook-message.entity";
import type {
  CreatedGuestbookMessageRecord,
  GuestbookMessageRecord,
} from "../infrastructure/guestbook-messages.mapper";
import {
  createGuestFingerprint,
  GuestbookMessagesController,
} from "./guestbook-messages.controller";

describe("GuestbookMessagesController", () => {
  it("passes the request fingerprint and current user into the create use case", async () => {
    const createGuestbookMessage = createCreateUseCaseDouble();
    const controller = new GuestbookMessagesController(
      createGuestbookMessage,
      createListUseCaseDouble(),
      createCurrentUserUseCaseDouble({ id: "user-1" }),
    );
    const request = createRequestDouble();

    await controller.create(
      {
        body: "hello",
        guestNickname: "guest",
      },
      request,
    );

    expect(createGuestbookMessage.execute).toHaveBeenCalledWith({
      body: "hello",
      guestNickname: "guest",
      guestFingerprint: createGuestFingerprint(request),
      honeypot: undefined,
      user: { id: "user-1" },
    });
  });

  it("maps invalid message input to a 400 response", async () => {
    const createGuestbookMessage = createCreateUseCaseDouble();
    createGuestbookMessage.execute.mockRejectedValue(new GuestbookMessageBodyEmptyError());
    const controller = new GuestbookMessagesController(
      createGuestbookMessage,
      createListUseCaseDouble(),
      createCurrentUserUseCaseDouble(null),
    );

    await expect(
      controller.create(
        {
          body: "",
        },
        createRequestDouble(),
      ),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: "GUESTBOOK_MESSAGE_REQUIRED",
        },
      },
      status: 400,
    });
  });

  it("maps anonymous rate limits to a 429 response", async () => {
    const createGuestbookMessage = createCreateUseCaseDouble();
    createGuestbookMessage.execute.mockRejectedValue(new GuestbookMessageRateLimitedError());
    const controller = new GuestbookMessagesController(
      createGuestbookMessage,
      createListUseCaseDouble(),
      createCurrentUserUseCaseDouble(null),
    );

    await expect(
      controller.create(
        {
          body: "hello",
          guestNickname: "guest",
        },
        createRequestDouble(),
      ),
    ).rejects.toMatchObject({
      response: {
        error: {
          code: "GUESTBOOK_RATE_LIMITED",
        },
      },
      status: 429,
    });
  });
});

function createCreateUseCaseDouble() {
  return {
    execute: vi.fn().mockResolvedValue(createGuestbookMessageRecord()),
  } as unknown as CreateGuestbookMessageUseCase<CreatedGuestbookMessageRecord> & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createListUseCaseDouble() {
  return {
    execute: vi.fn(),
  } as unknown as ListVisibleGuestbookMessagesUseCase<GuestbookMessageRecord> & {
    execute: ReturnType<typeof vi.fn>;
  };
}

function createCurrentUserUseCaseDouble(user: { id: string } | null) {
  return {
    execute: vi.fn().mockResolvedValue(user),
  } as unknown as GetCurrentUserUseCase;
}

function createRequestDouble() {
  return {
    headers: {
      cookie: "session=token",
      "user-agent": "Vitest",
      "x-forwarded-for": "203.0.113.10",
    },
    ip: "127.0.0.1",
  } as unknown as Request;
}

function createGuestbookMessageRecord() {
  const now = new Date("2026-07-02T00:00:00.000Z");

  return {
    id: "message-1",
    body: "hello",
    authorUserId: null,
    guestNickname: "guest",
    guestFingerprint: "fingerprint",
    likeCount: 0,
    status: "VISIBLE",
    createdAt: now,
    updatedAt: now,
    author: null,
  } as CreatedGuestbookMessageRecord;
}
