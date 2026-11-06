import RSS from "rss";
import { getArticles } from "../../lib/articles-api";
import { site } from "../../lib/site";

export async function GET() {
  try {
    const { data } = await getArticles({ page: 1, pageSize: 20 });
    if (!Array.isArray(data)) throw new Error("Invalid RSS article list.");
    const feed = new RSS({
      title: site.title,
      description: site.description,
      site_url: site.url,
      feed_url: new URL("/rss.xml", site.url).href,
      language: "zh-CN",
      generator: "AZ Notes",
      ttl: 5,
    });

    for (const article of data) {
      const date = new Date(article.publishedAt);
      if (
        typeof article.slug !== "string" ||
        !article.slug ||
        typeof article.publishedAt !== "string" ||
        !Number.isFinite(date.getTime())
      ) {
        throw new Error("Invalid RSS article data.");
      }
      feed.item({
        title: xmlText(article.title),
        description: xmlText(article.description)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;"),
        url: new URL(`/posts/${encodeURIComponent(article.slug)}`, site.url).href,
        author: xmlText(article.source?.author ?? article.source?.name ?? "Adrian"),
        categories: [article.category?.name, ...article.tags.map((tag) => tag.name)]
          .filter((name): name is string => name !== undefined)
          .map(xmlText),
        date,
      });
    }

    return new Response(feed.xml({ indent: true }), {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("RSS feed is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
}

function xmlText(value: string) {
  // CDATA still disallows XML 1.0 control characters and unpaired surrogates.
  return value.replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, "");
}
