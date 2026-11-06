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

class AdminArticleCommentConflictError extends Error {
  constructor() {
    super("The comment changed. Refresh before trying again.");
  }
}
export {
  AdminArticleCommentNotFoundError,
  AdminArticleCommentValidationError,
  AdminArticleCommentConflictError,
};
