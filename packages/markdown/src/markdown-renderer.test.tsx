// @vitest-environment jsdom

import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview, MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownPreview", () => {
  it("filters disallowed images before rendering or preloading them while preserving links", () => {
    const html = renderToStaticMarkup(
      <MarkdownPreview
        content={
          "![外部图片](https://collector.example.test/image.png)\n\n[![链接图片](https://collector.example.test/linked.png)](https://example.test/review)"
        }
        disallowedElements={["img"]}
        variant="stream"
      />,
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain('rel="preload"');
    expect(html).not.toContain("https://collector.example.test/image.png");
    expect(html).not.toContain("https://collector.example.test/linked.png");
    expect(html).not.toContain("data-rmiz");
    expect(html).toContain('href="https://example.test/review"');
  });

  it("keeps server-rendered article images zoomable without invalid paragraph markup", async () => {
    const stream = await renderToReadableStream(
      await MarkdownRenderer({ content: "![文章图片](https://example.test/article.png)" }),
    );
    await stream.allReady;
    const html = await new Response(stream).text();

    expect(html).toContain('src="https://example.test/article.png"');
    expect(html).toContain('<span data-rmiz=""');
    expect(html).not.toContain("<div");
    expect(html).not.toContain("node=");
  });

  it.each([
    "[![图片](https://example.test/article.png)](https://example.test/original)",
    "[*![图片](https://example.test/article.png)*](https://example.test/original)",
  ])("preserves linked images as links without nested zoom controls: %s", (content) => {
    const html = renderToStaticMarkup(<MarkdownPreview content={content} variant="stream" />);
    const container = document.createElement("div");
    container.innerHTML = html;
    const link = container.querySelector("a");

    expect(link?.getAttribute("href")).toBe("https://example.test/original");
    expect(link?.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.test/article.png",
    );
    expect(link?.querySelector("button, [data-rmiz]")).toBeNull();
    expect(html).not.toContain("node=");
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
    const container = document.createElement("div");
    container.innerHTML = html;
    const tableRegion = container.querySelector(".markdown-table-wrap");
    expect(tableRegion?.getAttribute("role")).toBe("region");
    expect(tableRegion?.getAttribute("aria-label")).toBe("表格，可横向滚动");
    expect(tableRegion?.getAttribute("tabindex")).toBe("0");
    expect(html).toContain("const status");
    expect(html).toContain("markdown-code-language");
    expect(html).toContain(">ts</span>");
    expect(html).not.toContain("raw html should not render");
  });
});
