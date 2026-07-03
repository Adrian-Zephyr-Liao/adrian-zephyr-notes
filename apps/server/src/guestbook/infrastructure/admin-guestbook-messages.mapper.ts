import type {
  AdminGuestbookMessageListItemResponse,
  AdminGuestbookMessagesResponse,
} from "@adrian-zephyr-notes/contracts";
import type {
  AdminGuestbookMessageListItem,
  AdminGuestbookMessagesPage,
} from "../domain/admin-guestbook-message.repository";

function toAdminGuestbookMessagesResponse(
  page: AdminGuestbookMessagesPage,
): AdminGuestbookMessagesResponse {
  return {
    data: page.data.map(toAdminGuestbookMessageListItemResponse),
    pagination: page.pagination,
  };
}

function toAdminGuestbookMessageListItemResponse(
  message: AdminGuestbookMessageListItem,
): AdminGuestbookMessageListItemResponse {
  return {
    ...message,
    createdAt: message.createdAt.toISOString(),
    pinnedAt: message.pinnedAt?.toISOString() ?? null,
    updatedAt: message.updatedAt.toISOString(),
  };
}

export { toAdminGuestbookMessageListItemResponse, toAdminGuestbookMessagesResponse };
