import { DOMParser, onErrorStopParsing } from "@xmldom/xmldom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const fetchMock = vi.fn<typeof fetch>();
const article = {
  slug: "rss-example",
  title: "中文 & <技术> ]]> 后段 ]]> \u0001\uD800🚀",
  description: '<img src="https://example.test/tracker" onerror="alert(1)"> & ]]> 后段 ]]>',
  source: null,
  category: { name: "工程 & 笔记" },
  tags: [{ name: "RSS" }],
  publishedAt: "2026-07-20T09:00:00.000Z",
  updatedAt: "2026-07-21T09:00:00.000Z",
};
const parse = (xml: string) =>
  new DOMParser({ onError: onErrorStopParsing }).parseFromString(xml, "application/xml");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("BACKEND_API_BASE_URL", "http://backend.test");
});
afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("RSS endpoint", () => {
  it("serializes safe, well-formed RSS from the public article list", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [article] }));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/rss+xml; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend.test/api/articles?page=1&pageSize=20",
      expect.objectContaining({ cache: "no-store" }),
    );
    const document = parse(await response.text());
    expect(document.documentElement?.getAttribute("version")).toBe("2.0");
    expect(document.getElementsByTagName("link")[0]?.textContent).toBe("https://zephyrai.site");
    expect(
      document
        .getElementsByTagNameNS("http://www.w3.org/2005/Atom", "link")[0]
        ?.getAttribute("href"),
    ).toBe("https://zephyrai.site/rss.xml");
    const item = document.getElementsByTagName("item")[0]!;
    expect(item.getElementsByTagName("title")[0]?.textContent).toBe(
      "中文 & <技术> ]]> 后段 ]]> 🚀",
    );
    expect(item.getElementsByTagName("link")[0]?.textContent).toBe(
      "https://zephyrai.site/posts/rss-example",
    );
    expect(item.getElementsByTagName("category")[0]?.textContent).toBe("工程 & 笔记");
    const summary = parse(`<div>${item.getElementsByTagName("description")[0]?.textContent}</div>`);
    expect(summary.getElementsByTagName("img").length).toBe(0);
    expect(summary.documentElement?.textContent).toBe(article.description);
  });

  it("keeps identity and publication time when an article is edited", async () => {
    const values = [];
    for (const changes of [
      {},
      { title: "修改后的文章标题", updatedAt: "2026-08-01T09:00:00.000Z" },
    ]) {
      fetchMock.mockResolvedValueOnce(Response.json({ data: [{ ...article, ...changes }] }));
      const document = parse(await (await GET()).text());
      values.push({
        guid: document.getElementsByTagName("guid")[0]?.textContent,
        date: document.getElementsByTagName("pubDate")[0]?.textContent,
      });
    }
    expect(values[0]).toEqual({
      guid: "https://zephyrai.site/posts/rss-example",
      date: new Date(article.publishedAt).toUTCString(),
    });
    expect(values[1]).toEqual(values[0]);
  });

  it("returns a valid empty feed when there are no published articles", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }));
    const response = await GET();
    expect(response.status).toBe(200);
    expect(parse(await response.text()).getElementsByTagName("item").length).toBe(0);
  });

  it.each([
    ["HTTP failure", () => Promise.resolve(new Response(null, { status: 500 }))],
    ["network failure", () => Promise.reject(new TypeError("offline"))],
    ["invalid JSON", () => Promise.resolve(new Response("not JSON"))],
    ["invalid list", () => Promise.resolve(Response.json({ data: "" }))],
    [
      "invalid date",
      () => Promise.resolve(Response.json({ data: [{ ...article, publishedAt: "invalid" }] })),
    ],
  ] as const)("does not cache an empty success after %s", async (_name, result) => {
    fetchMock.mockImplementationOnce(result);
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
  });
});
