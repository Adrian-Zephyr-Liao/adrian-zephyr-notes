import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_GUESTBOOK_MESSAGE_REPOSITORY,
  type AdminGuestbookMessageRepository,
  type AdminGuestbookMessageStatus,
  type ListAdminGuestbookMessagesFilters,
} from "../domain/admin-guestbook-message.repository";

type ListAdminGuestbookMessagesInput = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
};

@Injectable()
class ListAdminGuestbookMessagesUseCase {
  constructor(
    @Inject(ADMIN_GUESTBOOK_MESSAGE_REPOSITORY)
    private readonly adminGuestbookMessageRepository: AdminGuestbookMessageRepository,
  ) {}

  execute(input: ListAdminGuestbookMessagesInput = {}) {
    return this.adminGuestbookMessageRepository.list(
      normalizeListAdminGuestbookMessagesInput(input),
    );
  }
}

function normalizeListAdminGuestbookMessagesInput(
  input: ListAdminGuestbookMessagesInput,
): ListAdminGuestbookMessagesFilters {
  return {
    page: normalizePositiveInteger(input.page, 1),
    pageSize: Math.min(normalizePositiveInteger(input.pageSize, 20), 50),
    search: normalizeOptionalText(input.search),
    status: normalizeStatus(input.status),
  };
}

function normalizeStatus(value: string | undefined): AdminGuestbookMessageStatus | undefined {
  return value === "DELETED" || value === "HIDDEN" || value === "VISIBLE" ? value : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isInteger(value) || value === undefined || value < 1) {
    return fallback;
  }

  return value;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export { ListAdminGuestbookMessagesUseCase, normalizeListAdminGuestbookMessagesInput };
export type { ListAdminGuestbookMessagesInput };
