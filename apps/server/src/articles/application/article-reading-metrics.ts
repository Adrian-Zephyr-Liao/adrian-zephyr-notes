type ArticleReadingMetrics = {
  readingMinutes: number;
  wordCount: number;
};

const wordsPerMinute = 300;

function calculateArticleReadingMetrics(markdown: string): ArticleReadingMetrics {
  const text = stripMarkdownSyntax(markdown);
  const latinWordCount = text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
  const cjkCharacterCount = text.match(/[\u3400-\u9fff\uf900-\ufaff]/g)?.length ?? 0;
  const wordCount = latinWordCount + cjkCharacterCount;

  return {
    readingMinutes: Math.max(1, Math.ceil(wordCount / wordsPerMinute)),
    wordCount,
  };
}

function stripMarkdownSyntax(markdown: string) {
  return markdown
    .replaceAll(/```[\s\S]*?```/g, " ")
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replaceAll(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replaceAll(/[#>*_~|[\]()-]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

export { calculateArticleReadingMetrics };
export type { ArticleReadingMetrics };
