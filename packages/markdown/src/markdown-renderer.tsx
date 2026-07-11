import Markdown, { MarkdownAsync, MarkdownHooks, type Components } from "react-markdown";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { isValidElement, type ReactNode } from "react";
import type { PluggableList } from "unified";

import { CodeCopyButton } from "./code-copy-button";
import { cx } from "./utils";

type MarkdownRendererProps = {
  content: string;
  className?: string;
  variant?: "document" | "stream";
};

const documentRehypePlugins: PluggableList = [
  rehypeSlug,
  [
    rehypeAutolinkHeadings,
    {
      behavior: "append",
      properties: {
        className: ["markdown-heading-anchor"],
        ariaLabel: "链接到这个小节",
        tabIndex: -1,
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
];

const streamRehypePlugins: PluggableList = [rehypeSlug];

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
  li({ className, children, node: _node, ...props }) {
    if (typeof className === "string" && className.includes("task-list-item")) {
      return (
        <li className={className} {...props}>
          <label className="markdown-task-list-label">{children}</label>
        </li>
      );
    }

    return (
      <li className={className} {...props}>
        {children}
      </li>
    );
  },
  pre({ className, children, node: _node, ...props }) {
    const language = getCodeLanguage(props, children);

    return (
      <div className="markdown-code-shell" data-code-copy-root="">
        <div className="markdown-code-toolbar">
          <span className="markdown-code-language">{language}</span>
          <CodeCopyButton />
        </div>
        <pre className={className} {...props} aria-label={`${language} 代码块`}>
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

function getCodeLanguage(props: Record<string, unknown>, children: ReactNode) {
  const language = props["data-language"];

  if (typeof language === "string" && language.trim()) {
    return language.trim();
  }

  const languageFromCodeClass = getCodeLanguageFromChildren(children);

  if (languageFromCodeClass) {
    return languageFromCodeClass;
  }

  return "text";
}

function getCodeLanguageFromChildren(children: ReactNode) {
  const childNodes = Array.isArray(children) ? children : [children];

  for (const child of childNodes) {
    if (!isValidElement(child)) {
      continue;
    }

    const childProps = child.props as { className?: unknown };

    if (typeof childProps.className !== "string") {
      continue;
    }

    const languageMatch = /(?:^|\s)language-(\S+)/.exec(childProps.className);

    if (languageMatch?.[1]) {
      return languageMatch[1];
    }
  }

  return null;
}

function isExternalLink(href: string) {
  return href.startsWith("http://") || href.startsWith("https://");
}

async function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <article className={cx("markdown-body", className)}>
      <MarkdownAsync
        remarkPlugins={[remarkGfm]}
        rehypePlugins={documentRehypePlugins}
        components={markdownComponents}
        skipHtml
      >
        {content}
      </MarkdownAsync>
    </article>
  );
}

function MarkdownPreview({ content, className, variant = "document" }: MarkdownRendererProps) {
  const previewClassName = cx(
    "markdown-body",
    variant === "stream" && "markdown-body-stream",
    className,
  );

  if (variant === "stream") {
    return (
      <article className={previewClassName}>
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={streamRehypePlugins}
          components={markdownComponents}
          skipHtml
        >
          {content}
        </Markdown>
      </article>
    );
  }

  return (
    <article className={previewClassName}>
      <MarkdownHooks
        remarkPlugins={[remarkGfm]}
        rehypePlugins={documentRehypePlugins}
        components={markdownComponents}
        skipHtml
      >
        {content}
      </MarkdownHooks>
    </article>
  );
}

export { MarkdownPreview, MarkdownRenderer };
export type { MarkdownRendererProps };
