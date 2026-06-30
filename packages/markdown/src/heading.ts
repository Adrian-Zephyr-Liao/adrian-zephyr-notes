import GithubSlugger from "github-slugger";
import { toString } from "mdast-util-to-string";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

type MarkdownHeading = {
  id: string;
  depth: 2 | 3;
  text: string;
};

function getMarkdownHeadings(markdown: string) {
  const tree = unified().use(remarkParse).parse(markdown);
  const slugger = new GithubSlugger();
  const headings: MarkdownHeading[] = [];

  visit(tree, "heading", (node) => {
    if (node.depth !== 2 && node.depth !== 3) {
      return;
    }

    const text = toString(node).trim();

    if (!text) {
      return;
    }

    headings.push({
      id: slugger.slug(text),
      depth: node.depth,
      text,
    });
  });

  return headings;
}

export { getMarkdownHeadings };
export type { MarkdownHeading };
