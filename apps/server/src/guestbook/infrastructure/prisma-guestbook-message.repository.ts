import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AnonymousGuestbookMessageLimit,
  CreateAnonymousGuestbookMessageInput,
  CreateGuestbookMessageInput,
  GuestbookMessageRepository,
  GuestbookMessagesListInput,
} from "../domain/guestbook-message.repository";
import {
  createGuestbookMessageInclude,
  guestbookMessageCreateInclude,
  type CreatedGuestbookMessageRecord,
  type GuestbookMessageRecord,
} from "./guestbook-messages.mapper";

@Injectable()
class PrismaGuestbookMessageRepository implements GuestbookMessageRepository<
  GuestbookMessageRecord | CreatedGuestbookMessageRecord
> {
  constructor(private readonly prisma: PrismaService) {}

  createAnonymousWithinLimit(
    input: CreateAnonymousGuestbookMessageInput,
    policy: AnonymousGuestbookMessageLimit,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        // The quota check and insert must serialize across API processes for this fingerprint.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`guestbook:${input.guestFingerprint}`}, 0))`;
        const recentMessageCount = await tx.guestbookMessage.count({
          where: {
            authorUserId: null,
            guestFingerprint: input.guestFingerprint,
            createdAt: { gte: policy.since },
          },
        });
        if (recentMessageCount >= policy.limit) return null;

        return tx.guestbookMessage.create({
          data: { ...input, authorUserId: null },
          include: guestbookMessageCreateInclude,
        });
      },
      // After waiting for the lock, the count must see the previous transaction's commit.
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  create(input: CreateGuestbookMessageInput) {
    return this.prisma.guestbookMessage.create({
      data: input,
      include: guestbookMessageCreateInclude,
    });
  }

  async listVisible(input: GuestbookMessagesListInput) {
    const where = {
      status: "VISIBLE" as const,
    };
    const [messages, totalItems] = await this.prisma.$transaction([
      this.prisma.guestbookMessage.findMany({
        where,
        include: createGuestbookMessageInclude(input.viewerUserId),
        orderBy: [{ isPinned: "desc" }, { pinnedAt: "desc" }, { createdAt: "desc" }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.guestbookMessage.count({ where }),
    ]);

    return {
      data: messages,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }
}

export { PrismaGuestbookMessageRepository };
