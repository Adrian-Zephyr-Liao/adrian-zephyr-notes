import { createServer } from "node:http";
import {
  articles,
  category,
  emptyComments,
  emptyGuestbook,
  firstArticlePage,
  secondArticlePage,
  siteConfig,
  tag,
  tags,
} from "./responses.ts";

// Fixed transport responses exercise the real Next server without a database or production access.
const endpoints = new Map([
  ["/health", { ready: true }],
  ["/api/site-config", siteConfig],
  ["/api/auth/me", { user: null }],
  ["/api/articles/categories", { data: [category] }],
  ["/api/articles/categories/engineering", category],
  ["/api/articles/tags", tags],
  ["/api/articles/tags/design", tag],
  ["/api/guestbook/messages", emptyGuestbook],
  ...articles.flatMap((article) => [
    [`/api/articles/${article.slug}`, article],
    [`/api/articles/${article.slug}/comments`, emptyComments],
  ]),
]);

createServer((request, response) => {
  if (request.method !== "GET") {
    response.writeHead(405).end();
    return;
  }
  const url = new URL(request.url, "http://127.0.0.1:4311");
  const payload =
    url.pathname === "/api/articles"
      ? url.searchParams.get("page") === "2"
        ? secondArticlePage
        : firstArticlePage
      : endpoints.get(url.pathname);
  response.writeHead(payload === undefined ? 404 : 200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload ?? { error: { message: "Fixture endpoint not found" } }));
}).listen(4311, "127.0.0.1");
