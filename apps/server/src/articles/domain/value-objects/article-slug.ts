const ARTICLE_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,78}[a-z0-9])?$/;

class ArticleSlug {
  private constructor(private readonly value: string) {}

  static create(value: string) {
    const normalized = value.trim();

    if (!ARTICLE_SLUG_PATTERN.test(normalized)) {
      throw new Error("Article slug must be 3-80 lowercase URL-safe characters.");
    }

    return new ArticleSlug(normalized);
  }

  toString() {
    return this.value;
  }
}

export { ArticleSlug };
