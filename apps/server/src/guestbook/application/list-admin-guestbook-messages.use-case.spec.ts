import { describe, expect, it, vi } from "vitest";
import type { AdminGuestbookMessageRepository } from "../domain/admin-guestbook-message.repository";
import {
  ListAdminGuestbookMessagesUseCase,
  normalizeListAdminGuestbookMessagesInput,
} from "./list-admin-guestbook-messages.use-case";

describe("ListAdminGuestbookMessagesUseCase", () => {
  it("normalizes filters before querying guestbook messages", async () => {
    const repository = createRepositoryDouble();
    const useCase = new ListAdminGuestbookMessagesUseCase(repository);

    await useCase.execute({
      page: 0,
      pageSize: 500,
      search: "  hello  ",
      status: "DELETED",
    });

    expect(repository.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      search: "hello",
      status: "DELETED",
    });
  });
});

describe("normalizeListAdminGuestbookMessagesInput", () => {
  it("drops unsupported status filters", () => {
    expect(normalizeListAdminGuestbookMessagesInput({ status: "ALL" })).toEqual({
      page: 1,
      pageSize: 20,
      search: undefined,
      status: undefined,
    });
  });
});

function createRepositoryDouble() {
  return {
    list: vi.fn().mockResolvedValue({
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        totalItems: 0,
        totalPages: 0,
      },
    }),
    update: vi.fn(),
  } as unknown as AdminGuestbookMessageRepository & {
    list: ReturnType<typeof vi.fn>;
  };
}
