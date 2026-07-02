import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import type {
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

  countRecentAnonymousMessages(input: { guestFingerprint: string; since: Date }) {
    return this.prisma.guestbookMessage.count({
      where: {
        authorUserId: null,
        guestFingerprint: input.guestFingerprint,
        createdAt: {
          gte: input.since,
        },
      },
    });
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
        orderBy: {
          createdAt: "desc",
        },
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
