type InsertArticleImageMarkdownInput = {
  alt: string;
  markdown: string;
  selectionEnd: number;
  selectionStart: number;
  url: string;
};

type InsertArticleImageMarkdownResult = {
  markdown: string;
  selectionEnd: number;
  selectionStart: number;
};

function insertArticleImageMarkdown(
  input: InsertArticleImageMarkdownInput,
): InsertArticleImageMarkdownResult {
  const selectionStart = clamp(input.selectionStart, 0, input.markdown.length);
  const selectionEnd = clamp(input.selectionEnd, selectionStart, input.markdown.length);
  const imageMarkdown = `![${escapeMarkdownAlt(input.alt)}](${input.url})`;
  const markdown = `${input.markdown.slice(0, selectionStart)}${imageMarkdown}${input.markdown.slice(selectionEnd)}`;
  const nextSelection = selectionStart + imageMarkdown.length;

  return {
    markdown,
    selectionEnd: nextSelection,
    selectionStart: nextSelection,
  };
}

function toArticleImageAltText(originalName: string) {
  const fileName = originalName.split(/[\\/]/).pop()?.trim() ?? "";
  const extensionIndex = fileName.lastIndexOf(".");
  const stem = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  const normalized = stem.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

  return normalized && !normalized.startsWith(".") ? normalized : "文章图片";
}

function escapeMarkdownAlt(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("[", "\\[").replaceAll("]", "\\]");
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export { insertArticleImageMarkdown, toArticleImageAltText };
