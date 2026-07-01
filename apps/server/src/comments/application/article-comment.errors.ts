class ArticleCommentArticleNotFoundError extends Error {
  constructor() {
    super("Article not found.");
  }
}

class ArticleCommentAuthenticationRequiredError extends Error {
  constructor() {
    super("Login is required to comment.");
  }
}

class ArticleCommentParentNotFoundError extends Error {
  constructor() {
    super("Parent comment not found.");
  }
}

export {
  ArticleCommentArticleNotFoundError,
  ArticleCommentAuthenticationRequiredError,
  ArticleCommentParentNotFoundError,
};
