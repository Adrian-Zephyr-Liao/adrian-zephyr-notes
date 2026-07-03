class AdminGuestbookMessageNotFoundError extends Error {
  constructor() {
    super("Guestbook message not found.");
  }
}

class AdminGuestbookMessageValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export { AdminGuestbookMessageNotFoundError, AdminGuestbookMessageValidationError };
