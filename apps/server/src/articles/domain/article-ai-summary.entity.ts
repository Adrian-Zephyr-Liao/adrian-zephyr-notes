type ArticleAiSummaryStatus = "FAILED" | "GENERATING" | "PENDING" | "READY";

type ArticleAiSummaryProps = {
  id: string;
  articleId: string;
  summary: string | null;
  status: ArticleAiSummaryStatus;
  contentHash: string;
  promptVersion: string;
  provider: string | null;
  model: string | null;
  attemptCount: number;
  errorMessage: string | null;
  generatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateArticleAiSummaryProps = ArticleAiSummaryProps;

class ArticleAiSummary {
  private constructor(private readonly props: ArticleAiSummaryProps) {}

  static create(props: CreateArticleAiSummaryProps) {
    const summary = new ArticleAiSummary({
      ...props,
      id: requireText(props.id, "Article AI summary id"),
      articleId: requireText(props.articleId, "Article id"),
      contentHash: requireText(props.contentHash, "Article AI summary content hash"),
      promptVersion: requireText(props.promptVersion, "Article AI summary prompt version"),
      summary: normalizeOptionalText(props.summary),
      provider: normalizeOptionalText(props.provider),
      model: normalizeOptionalText(props.model),
      errorMessage: normalizeOptionalText(props.errorMessage),
      generatedAt: cloneDateOrNull(props.generatedAt),
      createdAt: cloneDate(props.createdAt),
      updatedAt: cloneDate(props.updatedAt),
    });

    if (summary.props.attemptCount < 0) {
      throw new Error("Article AI summary attempt count cannot be negative.");
    }

    if (
      summary.props.status === "READY" &&
      (!summary.props.summary || !summary.props.generatedAt)
    ) {
      throw new Error("Ready article AI summaries require summary text and generatedAt.");
    }

    return summary;
  }

  get id() {
    return this.props.id;
  }

  get articleId() {
    return this.props.articleId;
  }

  get summary() {
    return this.props.summary;
  }

  get status() {
    return this.props.status;
  }

  get contentHash() {
    return this.props.contentHash;
  }

  get promptVersion() {
    return this.props.promptVersion;
  }

  get generatedAt() {
    return cloneDateOrNull(this.props.generatedAt);
  }

  isReadyFor(contentHash: string, promptVersion: string) {
    return (
      this.props.status === "READY" &&
      this.props.contentHash === contentHash &&
      this.props.promptVersion === promptVersion &&
      this.props.summary !== null &&
      this.props.generatedAt !== null
    );
  }
}

function requireText(value: string, fieldName: string) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptionalText(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function cloneDate(value: Date) {
  return new Date(value.getTime());
}

function cloneDateOrNull(value: Date | null) {
  return value ? cloneDate(value) : null;
}

export { ArticleAiSummary };
export type { ArticleAiSummaryProps, ArticleAiSummaryStatus, CreateArticleAiSummaryProps };
