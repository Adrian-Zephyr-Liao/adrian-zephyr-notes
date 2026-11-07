// @vitest-environment jsdom

import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
    expect(tableRegion?.getAttribute("aria-label")).toBe(
      "表格 1：Stream output · Area、Status，可横向滚动",
    );
    expect(tableRegion?.getAttribute("tabindex")).toBe("0");
    expect(html).toContain("const status");
    expect(html).toContain("markdown-code-language");
    expect(html).toContain(">ts</span>");
    expect(html).not.toContain("raw html should not render");
  });
});

const repeatedTables = `## 方案比较

| **方案** | \`耗时\` |
| --- | --- |
| 甲 | 10ms |

| **方案** | \`耗时\` |
| --- | --- |
| 乙 | 20ms |`;

it.each(["stream", "document", "server"] as const)(
  "%s tables have unique contextual region names even with repeated headers",
  async (variant) => {
    const container = document.createElement("div");
    if (variant === "server") {
      const stream = await renderToReadableStream(
        await MarkdownRenderer({ content: repeatedTables }),
      );
      await stream.allReady;
      container.innerHTML = await new Response(stream).text();
    } else if (variant === "document") {
      vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
      const root = createRoot(container);
      try {
        await act(async () => root.render(<MarkdownPreview content={repeatedTables} />));
        verifyTableNames(container);
      } finally {
        await act(async () => root.unmount());
        vi.unstubAllGlobals();
      }
      return;
    } else {
      container.innerHTML = renderToStaticMarkup(
        <MarkdownPreview content={repeatedTables} variant="stream" />,
      );
    }
    verifyTableNames(container);
  },
);

function verifyTableNames(container: HTMLElement) {
  const regions = Array.from(container.querySelectorAll('.markdown-table-wrap[role="region"]'));
  const names = regions.map((region) => region.getAttribute("aria-label") ?? "");
  expect(regions).toHaveLength(2);
  expect(new Set(names).size).toBe(2);
  names.forEach((name, index) => {
    expect(name).toContain(`表格 ${index + 1}`);
    expect(name).toContain("方案比较");
    expect(name).toContain("方案、耗时");
    expect(name).toContain("可横向滚动");
    expect(name).not.toContain("**");
    expect(name).not.toContain("`耗时`");
    expect(regions[index].getAttribute("tabindex")).toBe("0");
    expect(regions[index].querySelector("table")).not.toBeNull();
  });
}

it("keeps long names bounded and uses data context when table headers are empty", () => {
  const container = document.createElement("div");
  const long = "超长列名".repeat(40);
  container.innerHTML = renderToStaticMarkup(
    <MarkdownPreview
      variant="stream"
      content={`| ${long} | 状态 |\n| --- | --- |\n| 一 | 二 |\n\n| | |\n| --- | --- |\n| 团队甲 | 已完成 |`}
    />,
  );
  const names = Array.from(container.querySelectorAll('[role="region"]')).map(
    (region) => region.getAttribute("aria-label") ?? "",
  );
  expect(names).toHaveLength(2);
  expect(Array.from(names[0]).length).toBeLessThanOrEqual(90);
  expect(names[0]).toContain("超长列名");
  expect(names[1]).toContain("团队甲、已完成");
  expect(new Set(names).size).toBe(2);
});
