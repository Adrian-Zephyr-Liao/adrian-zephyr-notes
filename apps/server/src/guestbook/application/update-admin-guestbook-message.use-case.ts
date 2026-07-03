import { Inject, Injectable } from "@nestjs/common";
import {
  ADMIN_GUESTBOOK_MESSAGE_REPOSITORY,
  type AdminGuestbookMessageRepository,
  type AdminGuestbookMessageStatus,
  type UpdateAdminGuestbookMessageInput,
} from "../domain/admin-guestbook-message.repository";
import {
  AdminGuestbookMessageNotFoundError,
  AdminGuestbookMessageValidationError,
} from "./admin-guestbook-message.errors";

type UpdateAdminGuestbookMessageUseCaseInput = {
  id: string;
  isPinned?: boolean;
  status?: string;
};

@Injectable()
class UpdateAdminGuestbookMessageUseCase {
  constructor(
    @Inject(ADMIN_GUESTBOOK_MESSAGE_REPOSITORY)
    private readonly adminGuestbookMessageRepository: AdminGuestbookMessageRepository,
  ) {}

  async execute(input: UpdateAdminGuestbookMessageUseCaseInput, now = new Date()) {
    const updateInput = normalizeUpdateAdminGuestbookMessageInput(input, now);
    const message = await this.adminGuestbookMessageRepository.update(updateInput);

    if (!message) {
      throw new AdminGuestbookMessageNotFoundError();
    }

    return message;
  }
}

function normalizeUpdateAdminGuestbookMessageInput(
  input: UpdateAdminGuestbookMessageUseCaseInput,
  now: Date,
): UpdateAdminGuestbookMessageInput {
  const updateInput: UpdateAdminGuestbookMessageInput = {
    id: input.id,
  };

  if (input.status !== undefined) {
    updateInput.status = normalizeGuestbookMessageStatus(input.status);
  }

  if (input.isPinned !== undefined) {
    updateInput.isPinned = input.isPinned;
    updateInput.pinnedAt = input.isPinned ? now : null;
  }

  if (updateInput.status === undefined && updateInput.isPinned === undefined) {
    throw new AdminGuestbookMessageValidationError("No guestbook moderation changes provided.");
  }

  return updateInput;
}

function normalizeGuestbookMessageStatus(value: string): AdminGuestbookMessageStatus {
  if (value === "DELETED" || value === "HIDDEN" || value === "VISIBLE") {
    return value;
  }

  throw new AdminGuestbookMessageValidationError("Unsupported guestbook message status.");
}

export {
  UpdateAdminGuestbookMessageUseCase,
  normalizeGuestbookMessageStatus,
  normalizeUpdateAdminGuestbookMessageInput,
};
export type { UpdateAdminGuestbookMessageUseCaseInput };
