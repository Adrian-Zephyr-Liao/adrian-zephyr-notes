class AdminArticleCommentNotFoundError extends Error {
  constructor() {
    super("Article comment not found.");
  }
}

class AdminArticleCommentValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export { AdminArticleCommentNotFoundError, AdminArticleCommentValidationError };
