import { MarkdownAsync, type Components } from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { CodeCopyButton } from "./code-copy-button";
import { cx } from "./utils";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

const markdownComponents = {
  a({ className, href = "", children, node: _node, ...props }) {
    return (
      <a
        className={cx("markdown-link", className)}
        href={href}
        target={isExternalLink(href) ? "_blank" : undefined}
        rel={isExternalLink(href) ? "noreferrer" : undefined}
        {...props}
      >
        {children}
      </a>
    );
  },
  pre({ className, children, node: _node, ...props }) {
    const language = getCodeLanguage(props);

    return (
      <div className="markdown-code-shell" data-code-copy-root="">
        <div className="markdown-code-toolbar">
          <span className="markdown-code-language">{language}</span>
          <CodeCopyButton />
        </div>
        <pre className={className} {...props}>
          {children}
        </pre>
      </div>
    );
  },
  table({ className, node: _node, ...props }) {
    return (
      <div className="markdown-table-wrap">
        <table className={className} {...props} />
      </div>
    );
  },
} satisfies Components;

function getCodeLanguage(props: Record<string, unknown>) {
  const language = props["data-language"];

  if (typeof language === "string" && language.trim()) {
    return language.trim();
  }

  return "text";
}

function isExternalLink(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

async function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <article className={cx("markdown-body", className)}>
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeSlug,
          [
            rehypeAutolinkHeadings,
            {
              behavior: "append",
              properties: {
                className: ["markdown-heading-anchor"],
                ariaLabel: "链接到这个小节",
              },
              content: {
                type: "element",
                tagName: "span",
                properties: { ariaHidden: "true" },
                children: [{ type: "text", value: "#" }],
              },
            },
          ],
          [
            rehypePrettyCode,
            {
              keepBackground: false,
              theme: {
                light: "github-light",
                dark: "github-dark",
              },
            },
          ],
        ]}
        components={markdownComponents}
        skipHtml
      >
        {content}
      </MarkdownAsync>
    </article>
  );
}

export { MarkdownRenderer };
export type { MarkdownRendererProps };
