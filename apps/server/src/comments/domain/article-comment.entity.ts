const ARTICLE_COMMENT_BODY_MAX_LENGTH = 1000;

class ArticleCommentBody {
  private constructor(private readonly value: string) {}

  static create(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new ArticleCommentBodyEmptyError();
    }

    if (normalizedValue.length > ARTICLE_COMMENT_BODY_MAX_LENGTH) {
      throw new ArticleCommentBodyTooLongError();
    }

    return new ArticleCommentBody(normalizedValue);
  }

  toString() {
    return this.value;
  }
}

class ArticleCommentBodyEmptyError extends Error {
  constructor() {
    super("Comment body is required.");
  }
}

class ArticleCommentBodyTooLongError extends Error {
  constructor() {
    super(`Comment body must be at most ${ARTICLE_COMMENT_BODY_MAX_LENGTH} characters.`);
  }
}

export {
  ARTICLE_COMMENT_BODY_MAX_LENGTH,
  ArticleCommentBody,
  ArticleCommentBodyEmptyError,
  ArticleCommentBodyTooLongError,
};
