const ARTICLE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class ArticleId {
  private constructor(private readonly value: string) {}

  static create(value: string) {
    const normalized = value.trim();

    if (!ARTICLE_ID_PATTERN.test(normalized)) {
      throw new Error("Article id must be a valid UUID.");
    }

    return new ArticleId(normalized);
  }

  toString() {
    return this.value;
  }
}

export { ArticleId };
