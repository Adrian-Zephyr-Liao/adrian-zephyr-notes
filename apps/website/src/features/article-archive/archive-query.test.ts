import { describe, expect, it } from "vitest";
import { archiveHref, parseArchiveQuery } from "./archive-query";

describe("archive queries", () => {
  it("trims filters and uses the first repeated parameter", () => {
    expect(
      parseArchiveQuery({
        q: ["  前端 & Agent  ", "ignored"],
        category: "  engineering  ",
        tag: "  ",
        page: [" 2 ", "3"],
        view: " timeline ",
      }),
    ).toEqual({
      q: "前端 & Agent",
      category: "engineering",
      tag: undefined,
      page: 2,
      view: "timeline",
    });
  });

  it.each([undefined, "", "0", "-1", "1.5", "1e2", "Infinity", "NaN", "10001", "9007199254740993"])(
    "falls back to page one for an invalid page %s",
    (page) => {
      expect(parseArchiveQuery({ page, view: "unknown" })).toMatchObject({
        page: 1,
        view: "cover",
      });
    },
  );

  it("accepts the upper page boundary and omits default query values", () => {
    expect(parseArchiveQuery({ page: "10000" }).page).toBe(10000);
    expect(archiveHref(parseArchiveQuery({ page: "1", view: "cover" }))).toBe("/archives");
  });

  it("encodes Chinese and reserved characters without losing filters when paging", () => {
    const query = parseArchiveQuery({
      q: "前端 & Agent + / #",
      category: "工程/实践",
      tag: "C++",
      view: "timeline",
    });
    const href = archiveHref(query, { page: 3 });
    expect(href).toBe(
      "/archives?q=%E5%89%8D%E7%AB%AF+%26+Agent+%2B+%2F+%23&category=%E5%B7%A5%E7%A8%8B%2F%E5%AE%9E%E8%B7%B5&tag=C%2B%2B&page=3&view=timeline",
    );
    const params = new URL(href, "https://example.test").searchParams;
    expect(params.get("q")).toBe(query.q);
    expect(params.get("category")).toBe(query.category);
    expect(params.get("tag")).toBe(query.tag);
  });

  it("resets pagination when filters change while preserving the view", () => {
    const query = parseArchiveQuery({
      q: "React",
      category: "web",
      tag: "css",
      page: "4",
      view: "timeline",
    });
    expect(archiveHref(query, { q: "Next" })).toBe(
      "/archives?q=Next&category=web&tag=css&view=timeline",
    );
    expect(archiveHref(query, { category: null })).toBe("/archives?q=React&tag=css&view=timeline");
    expect(archiveHref(query, { tag: undefined })).toBe(
      "/archives?q=React&category=web&view=timeline",
    );
    expect(archiveHref(query, { q: "   " })).toBe("/archives?category=web&tag=css&view=timeline");
  });

  it("preserves the page for view changes and unchanged filters", () => {
    const query = parseArchiveQuery({ q: "React", page: "4", view: "timeline" });
    expect(archiveHref(query, { view: "cover" })).toBe("/archives?q=React&page=4");
    expect(archiveHref(query, { q: " React " })).toBe("/archives?q=React&page=4&view=timeline");
    expect(archiveHref(query, { q: "Next", page: 2 })).toBe(
      "/archives?q=Next&page=2&view=timeline",
    );
    expect(archiveHref(query, { page: null, view: null })).toBe("/archives?q=React");
  });
});
