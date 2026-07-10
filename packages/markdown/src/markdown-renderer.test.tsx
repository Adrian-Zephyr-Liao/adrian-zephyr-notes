import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownPreview } from "./markdown-renderer";

describe("MarkdownPreview", () => {
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
