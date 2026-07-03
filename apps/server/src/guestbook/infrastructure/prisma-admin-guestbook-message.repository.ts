import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type {
  AdminGuestbookMessageListItem,
  AdminGuestbookMessageRepository,
  ListAdminGuestbookMessagesFilters,
  UpdateAdminGuestbookMessageInput,
} from "../domain/admin-guestbook-message.repository";

const adminGuestbookMessageInclude = {
  author: true,
} satisfies Prisma.GuestbookMessageInclude;

type AdminGuestbookMessageRecord = Prisma.GuestbookMessageGetPayload<{
  include: typeof adminGuestbookMessageInclude;
}>;

@Injectable()
class PrismaAdminGuestbookMessageRepository implements AdminGuestbookMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filters: ListAdminGuestbookMessagesFilters) {
    const where = buildAdminGuestbookMessageWhere(filters);
    const [records, totalItems] = await this.prisma.$transaction([
      this.prisma.guestbookMessage.findMany({
        where,
        include: adminGuestbookMessageInclude,
        orderBy: [{ isPinned: "desc" }, { pinnedAt: "desc" }, { createdAt: "desc" }],
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      this.prisma.guestbookMessage.count({ where }),
    ]);

    return {
      data: records.map(toAdminGuestbookMessageListItem),
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / filters.pageSize),
      },
    };
  }

  async update(input: UpdateAdminGuestbookMessageInput) {
    try {
      const record = await this.prisma.guestbookMessage.update({
        where: { id: input.id },
        data: buildGuestbookMessageUpdateData(input),
        include: adminGuestbookMessageInclude,
      });

      return toAdminGuestbookMessageListItem(record);
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}

function buildAdminGuestbookMessageWhere(
  filters: ListAdminGuestbookMessagesFilters,
): Prisma.GuestbookMessageWhereInput {
  const where: Prisma.GuestbookMessageWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { body: { contains: filters.search, mode: "insensitive" } },
      { guestNickname: { contains: filters.search, mode: "insensitive" } },
      { author: { login: { contains: filters.search, mode: "insensitive" } } },
      { author: { name: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return where;
}

function buildGuestbookMessageUpdateData(
  input: UpdateAdminGuestbookMessageInput,
): Prisma.GuestbookMessageUpdateInput {
  const data: Prisma.GuestbookMessageUpdateInput = {};

  if (input.status !== undefined) {
    data.status = input.status;
  }

  if (input.isPinned !== undefined) {
    data.isPinned = input.isPinned;
    data.pinnedAt = input.pinnedAt ?? null;
  }

  return data;
}

function toAdminGuestbookMessageListItem(
  record: AdminGuestbookMessageRecord,
): AdminGuestbookMessageListItem {
  return {
    id: record.id,
    body: record.body,
    author: record.author
      ? {
          type: "GITHUB",
          id: record.author.id,
          login: record.author.login,
          name: record.author.name,
          avatarUrl: record.author.avatarUrl,
          profileUrl: record.author.profileUrl,
        }
      : {
          type: "GUEST",
          nickname: record.guestNickname ?? "访客",
          avatarSeed: record.guestFingerprint ?? record.id,
        },
    guestFingerprint: record.guestFingerprint,
    status: record.status,
    isPinned: record.isPinned,
    pinnedAt: record.pinnedAt,
    likeCount: record.likeCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function isPrismaRecordNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export { PrismaAdminGuestbookMessageRepository };
