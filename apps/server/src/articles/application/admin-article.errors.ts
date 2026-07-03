class AdminArticleNotFoundError extends Error {
  constructor() {
    super("Admin article not found.");
  }
}

class AdminArticleValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export { AdminArticleNotFoundError, AdminArticleValidationError };
