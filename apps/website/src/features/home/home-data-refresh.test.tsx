// @vitest-environment jsdom

import type { ArticleListItemResponse } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { FeaturedReading } from "./featured-reading";
import { RecentArticles } from "./recent-articles";

afterEach(cleanup);

describe("featured reading data refresh", () => {
  it("keeps the active card, visible counter and live text consistent when the list shrinks", () => {
    const page = render(
      <FeaturedReading articles={[article("first"), article("second"), article("third")]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "下一篇封面" }));
    fireEvent.click(screen.getByRole("button", { name: "下一篇封面" }));
    expect(screen.getByText("第 3 篇，共 3 篇：third title")).toBeDefined();

    page.rerender(<FeaturedReading articles={[article("first"), article("second")]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/first");
    expect(screen.getByText("第 1 篇，共 2 篇：first title")).toBeDefined();
    expect(screen.getByText("01").parentElement?.textContent?.replace(/\s/g, "")).toBe("01/02");

    fireEvent.click(screen.getByRole("button", { name: "下一篇封面" }));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/second");
    expect(screen.getByText("第 2 篇，共 2 篇：second title")).toBeDefined();
  });

  it("uses refreshed article data and resets an empty carousel without an invalid counter", () => {
    const page = render(<FeaturedReading articles={[article("first"), article("second")]} />);
    fireEvent.click(screen.getByRole("button", { name: "下一篇封面" }));
    page.rerender(<FeaturedReading articles={[article("new-first"), article("new-second")]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/new-second");
    expect(screen.getByText("第 2 篇，共 2 篇：new-second title")).toBeDefined();

    page.rerender(<FeaturedReading articles={[]} />);
    expect(screen.queryByRole("region", { name: "翻阅新近文章" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();

    page.rerender(<FeaturedReading articles={[article("only")]} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/only");
    expect(screen.getByText("第 1 篇，共 1 篇：only title")).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("wraps with keyboard arrows while keeping control focus and inactive links out of tab order", () => {
    render(<FeaturedReading articles={[article("first"), article("second"), article("third")]} />);
    const next = screen.getByRole("button", { name: "下一篇封面" });
    next.focus();
    fireEvent.keyDown(next, { key: "ArrowLeft" });
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/third");
    expect(document.activeElement).toBe(next);

    fireEvent.keyDown(next, { key: "ArrowRight" });
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/first");
    expect(document.activeElement).toBe(next);
    const links = screen.getAllByRole("link", { hidden: true });
    expect(links.filter((link) => link.tabIndex === 0)).toHaveLength(1);
    expect(links.filter((link) => link.tabIndex === -1)).toHaveLength(2);
    for (const link of links.filter((link) => link.tabIndex === -1)) {
      expect(link.closest("article")?.hasAttribute("inert")).toBe(true);
      expect(link.closest("article")?.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("recent article category refresh", () => {
  it("returns to all articles when the selected category disappears and does not restore an obsolete selection", () => {
    const first = article("first", "engineering");
    const second = article("second", "design");
    const page = render(<RecentArticles articles={[first, second]} />);
    fireEvent.click(screen.getByRole("button", { name: "engineering" }));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/first");

    page.rerender(<RecentArticles articles={[second]} />);
    expect(screen.getByRole("button", { name: "全部" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/second");
    expect(screen.getByText("显示 1 篇近期文章")).toBeDefined();

    page.rerender(<RecentArticles articles={[first, second]} />);
    expect(screen.getByRole("button", { name: "全部" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("显示 2 篇近期文章")).toBeDefined();
  });

  it("preserves a category that still exists while replacing its articles", () => {
    const page = render(
      <RecentArticles articles={[article("first", "engineering"), article("second", "design")]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "engineering" }));

    page.rerender(
      <RecentArticles
        articles={[article("replacement", "engineering"), article("other", "design")]}
      />,
    );
    expect(screen.getByRole("button", { name: "engineering" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("link").getAttribute("href")).toBe("/posts/replacement");
    expect(screen.getByText("显示 1 篇近期文章")).toBeDefined();
  });

  it("handles an empty refresh and keeps all articles selected when content returns", () => {
    const articles = [article("first", "engineering"), article("second", "design")];
    const page = render(<RecentArticles articles={articles} />);
    fireEvent.click(screen.getByRole("button", { name: "engineering" }));
    page.rerender(<RecentArticles articles={[]} />);
    expect(screen.getByRole("button", { name: "全部" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("显示 0 篇近期文章")).toBeDefined();
    expect(screen.queryByRole("link")).toBeNull();

    page.rerender(<RecentArticles articles={articles} />);
    expect(screen.getByRole("button", { name: "全部" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

function article(id: string, category = "engineering"): ArticleListItemResponse {
  return {
    id,
    slug: id,
    title: `${id} title`,
    description: `${id} description`,
    origin: "ORIGINAL",
    source: null,
    category: { slug: category, name: category },
    tags: [],
    coverImageUrl: null,
    wordCount: 400,
    readingMinutes: 2,
    publishedAt: "2026-11-06T12:00:00.000Z",
    updatedAt: "2026-11-06T12:00:00.000Z",
  };
}
