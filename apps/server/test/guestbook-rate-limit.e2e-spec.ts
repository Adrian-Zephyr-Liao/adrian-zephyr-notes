import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaService } from "../src/database/prisma.service";
import {
  ANONYMOUS_MESSAGE_WINDOW_MS,
  CreateGuestbookMessageUseCase,
} from "../src/guestbook/application/create-guestbook-message.use-case";
import { GuestbookMessageRateLimitedError } from "../src/guestbook/application/guestbook-message.errors";
import { toGuestbookMessageResponse } from "../src/guestbook/infrastructure/guestbook-messages.mapper";
import { PrismaGuestbookMessageRepository } from "../src/guestbook/infrastructure/prisma-guestbook-message.repository";

const databaseUrl = process.env.GUESTBOOK_TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/azn_guestbook_test" ||
    url.username !== "azn_guestbook_test" ||
    !url.port ||
    url.port === "5432"
  ) {
    throw new Error(
      "Guestbook tests require the dedicated loopback test database on a nondefault port.",
    );
  }
}

describe.skipIf(!databaseUrl)("anonymous guestbook quotas through isolated PostgreSQL", () => {
  const prefix = `rate-test-${randomUUID()}`;
  const userId = randomUUID();
  const fingerprints = new Set<string>();
  let prisma: PrismaClient;
  let repository: PrismaGuestbookMessageRepository;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg(databaseUrl!) });
    repository = new PrismaGuestbookMessageRepository(prisma as unknown as PrismaService);
    await prisma.user.create({
      data: {
        id: userId,
        githubId: prefix,
        login: prefix,
        profileUrl: "https://example.test/reader",
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    try {
      await prisma.guestbookMessage.deleteMany({
        where: { OR: [{ guestFingerprint: { in: [...fingerprints] } }, { authorUserId: userId }] },
      });
      await prisma.user.deleteMany({ where: { id: userId } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("accepts at most three simultaneous anonymous posts per fingerprint, independently", async () => {
    const [first, second] = await Promise.all([
      Promise.allSettled(Array.from({ length: 8 }, () => post("first"))),
      Promise.allSettled(Array.from({ length: 5 }, () => post("second"))),
    ]);

    for (const results of [first, second]) {
      const accepted = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(accepted).toHaveLength(3);
      for (const result of rejected)
        expect(result.reason).toBeInstanceOf(GuestbookMessageRateLimitedError);
      expect(toGuestbookMessageResponse(accepted[0]!.value)).toMatchObject({
        body: "A guestbook message.",
        author: { type: "GUEST", nickname: "Reader" },
        likeCount: 0,
        likedByMe: false,
      });
    }
    expect(
      await prisma.guestbookMessage.count({ where: { guestFingerprint: fingerprint("first") } }),
    ).toBe(3);
    expect(
      await prisma.guestbookMessage.count({ where: { guestFingerprint: fingerprint("second") } }),
    ).toBe(3);
  });

  it("excludes expired posts while counting the inclusive ten-minute boundary", async () => {
    const now = new Date();
    const since = new Date(now.getTime() - ANONYMOUS_MESSAGE_WINDOW_MS);
    await prisma.guestbookMessage.createMany({
      data: [
        ...Array.from({ length: 3 }, () => ({
          guestFingerprint: fingerprint("expiry"),
          guestNickname: "Reader",
          body: "Expired fixture.",
          createdAt: new Date(since.getTime() - 1),
        })),
        {
          guestFingerprint: fingerprint("expiry"),
          guestNickname: "Reader",
          body: "Boundary fixture.",
          createdAt: since,
        },
      ],
    });

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => post("expiry", { now })),
    );
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    for (const result of results) {
      if (result.status === "rejected")
        expect(result.reason).toBeInstanceOf(GuestbookMessageRateLimitedError);
    }
  });

  it("rolls back an insertion error and releases the fingerprint lock", async () => {
    await expect(
      post("rollback", { body: "PostgreSQL rejects this NUL: \u0000" }),
    ).rejects.toThrow();
    expect(
      await prisma.guestbookMessage.count({ where: { guestFingerprint: fingerprint("rollback") } }),
    ).toBe(0);

    const results = await Promise.allSettled(Array.from({ length: 3 }, () => post("rollback")));
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    await expect(post("rollback")).rejects.toBeInstanceOf(GuestbookMessageRateLimitedError);
    expect(
      await prisma.guestbookMessage.count({ where: { guestFingerprint: fingerprint("rollback") } }),
    ).toBe(3);
  });

  it("leaves authenticated posting independent of anonymous quotas", async () => {
    await Promise.all(Array.from({ length: 3 }, () => post("authenticated")));
    const useCase = new CreateGuestbookMessageUseCase(repository);
    const messages = await Promise.all(
      Array.from({ length: 4 }, () =>
        useCase.execute({
          body: "Authenticated message.",
          guestFingerprint: fingerprint("authenticated"),
          user: { id: userId },
        }),
      ),
    );

    expect(messages).toHaveLength(4);
    expect(
      messages.every(
        (message) => message.authorUserId === userId && message.guestFingerprint === null,
      ),
    ).toBe(true);
    expect(toGuestbookMessageResponse(messages[0]!)).toMatchObject({
      author: { type: "GITHUB", id: userId },
    });
  });

  function fingerprint(suffix: string) {
    const value = `${prefix}-${suffix}`;
    fingerprints.add(value);
    return value;
  }

  function post(suffix: string, options: { body?: string; now?: Date } = {}) {
    return new CreateGuestbookMessageUseCase(repository).execute({
      body: options.body ?? "A guestbook message.",
      guestNickname: "Reader",
      guestFingerprint: fingerprint(suffix),
      user: null,
      now: options.now,
    });
  }
});
