// Read the rendered article so Markdown syntax and link URLs never reach the voice.
function getReadingChunks(content: HTMLElement, title: string) {
  const copy = content.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll(
      "pre, [data-code-copy-root], svg, script, style, button, [hidden], [aria-hidden='true'], .markdown-heading-anchor",
    )
    .forEach((element) => element.remove());
  copy.querySelectorAll("br, p, h1, h2, h3, h4, h5, h6, li, blockquote, tr").forEach((element) => {
    element.prepend("\n");
    element.append("\n");
  });
  copy.querySelectorAll("td, th").forEach((element) => element.append("，"));

  const body = copy.textContent?.trim() ?? "";
  if (!body) return [];

  // Short utterances avoid handing an entire long article to the speech engine.
  return `${title}\n${body}`
    .split(/\n+/)
    .flatMap((paragraph) => paragraph.match(/[^。！？.!?；;]+[。！？.!?；;]?/gu) ?? [])
    .flatMap((sentence) => {
      const characters = Array.from(sentence.replace(/\s+/g, " ").trim());
      const chunks: string[] = [];
      for (let start = 0; start < characters.length; start += 160) {
        chunks.push(characters.slice(start, start + 160).join(""));
      }
      return chunks;
    });
}

export { getReadingChunks };
