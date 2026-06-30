import { markdownSyntaxShowcasePost } from "./markdown-syntax-showcase";

const posts = [markdownSyntaxShowcasePost];

function getAllPosts() {
  return posts;
}

function getPostBySlug(slug: string) {
  return posts.find((post) => post.slug === slug);
}

export { getAllPosts, getPostBySlug };
export type BlogPost = (typeof posts)[number];
