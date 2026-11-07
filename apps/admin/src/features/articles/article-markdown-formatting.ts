type ArticleMarkdownFormat = "bold" | "italic" | "heading" | "link" | "code" | "quote";

function formatArticleMarkdownSelection({
  markdown,
  selectionStart,
  selectionEnd,
  format,
}: {
  markdown: string;
  selectionStart: number;
  selectionEnd: number;
  format: ArticleMarkdownFormat;
}) {
  if (format === "heading" || format === "quote") {
    const start = selectionStart === 0 ? 0 : markdown.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextLine = markdown.indexOf("\n", selectionEnd);
    const end = nextLine === -1 ? markdown.length : nextLine;
    const prefix = format === "heading" ? "## " : "> ";
    const replacement = markdown
      .slice(start, end)
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
    return {
      markdown: markdown.slice(0, start) + replacement + markdown.slice(end),
      selectionStart: start + prefix.length,
      selectionEnd: start + replacement.length,
    };
  }

  const selected = markdown.slice(selectionStart, selectionEnd);
  const label = selected || (format === "link" ? "链接文字" : format === "code" ? "code" : "文字");
  const marker = format === "bold" ? "**" : format === "italic" ? "*" : "`";
  const replacement = format === "link" ? `[${label}](https://)` : `${marker}${label}${marker}`;
  const nextStart = selectionStart + (format === "link" ? label.length + 3 : marker.length);
  return {
    markdown: markdown.slice(0, selectionStart) + replacement + markdown.slice(selectionEnd),
    selectionStart: nextStart,
    selectionEnd: nextStart + (format === "link" ? "https://".length : label.length),
  };
}

export { formatArticleMarkdownSelection };
export type { ArticleMarkdownFormat };
