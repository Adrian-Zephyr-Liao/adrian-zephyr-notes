// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MarkdownPreview } from "./markdown-renderer";

describe("MarkdownPreview", () => {
  it("filters disallowed images before rendering or preloading them while preserving links", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        content={
          "![外部图片](https://collector.example.test/image.png)\n\n[核对链接](https://example.test/review)"
        }
        disallowedElements={["img"]}
        variant="stream"
      />,
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain('rel="preload"');
    expect(html).not.toContain("https://collector.example.test/image.png");
    expect(html).toContain('href="https://example.test/review"');
  });

  it("keeps article images enabled in document previews by default", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    try {
      flushSync(() =>
        root.render(<MarkdownPreview content="![文章图片](https://example.test/article.png)" />),
      );
      await vi.waitFor(() => {
        expect(container.querySelector("img")?.getAttribute("src")).toBe(
          "https://example.test/article.png",
        );
      });
    } finally {
      root.unmount();
    }
  });

  it("renders stream markdown with GFM, code blocks, and skipped raw HTML", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        content={`# Stream output

- [x] review markdown

| Area | Status |
| --- | --- |
| Code | Works |

\`\`\`ts
const status = "ok";
\`\`\`

<div>raw html should not render</div>`}
        variant="stream"
      />,
    );

    expect(html).toContain("<h1");
    expect(html).toContain("Stream output");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<table");
    expect(html).toContain("const status");
    expect(html).toContain("markdown-code-language");
    expect(html).toContain(">ts</span>");
    expect(html).not.toContain("raw html should not render");
  });
});
