class ArticleNotFoundError extends Error {
  constructor(slug: string) {
    super(`Article not found: ${slug}`);
    this.name = "ArticleNotFoundError";
  }
}

export { ArticleNotFoundError };
