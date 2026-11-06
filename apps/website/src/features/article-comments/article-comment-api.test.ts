import { afterEach, describe, expect, it, vi } from "vitest";
import { loadArticleComments } from "./article-comment-api";

afterEach(() => vi.unstubAllGlobals());

describe("article comment reads", () => {
  it("propagates a backend failure rather than reporting an empty discussion", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(loadArticleComments("article")).rejects.toMatchObject({ status: 503 });
  });

  it("propagates connection failures so the reader can retry", async () => {
    const failure = new Error("offline");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(failure));
    await expect(loadArticleComments("article")).rejects.toBe(failure);
  });
});
