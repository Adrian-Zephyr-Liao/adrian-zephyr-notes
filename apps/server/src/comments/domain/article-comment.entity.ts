class ArticleCommentBody {
  private constructor(private readonly value: string) {}

  static create(value: string) {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new ArticleCommentBodyEmptyError();
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

export { ArticleCommentBody, ArticleCommentBodyEmptyError };
