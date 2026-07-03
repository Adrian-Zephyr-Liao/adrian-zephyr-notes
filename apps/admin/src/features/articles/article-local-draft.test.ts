import { describe, expect, it, vi } from "vitest";
import type { ArticleEditorValues } from "./article-editor";
import {
  areArticleEditorValuesEqual,
  createArticleLocalDraftKey,
  createArticleLocalDraftRecord,
  pickLatestRestorableArticleDraft,
  readArticleLocalDraft,
  removeArticleLocalDraft,
  shouldRestoreArticleLocalDraft,
  writeArticleLocalDraft,
} from "./article-local-draft";

describe("article local draft", () => {
  it("scopes drafts by admin and article", () => {
    expect(createArticleLocalDraftKey({ adminLogin: "Adrian", articleId: "article-1" })).toBe(
      "az-notes:admin:article-draft:Adrian:article%3Aarticle-1",
    );
    expect(createArticleLocalDraftKey({ adminLogin: "Adrian" })).toBe(
      "az-notes:admin:article-draft:Adrian:new",
    );
  });

  it("persists and reads a valid draft record", () => {
    const storage = createMemoryStorage();
    const record = createArticleLocalDraftRecord({
      articleId: "article-1",
      baseArticleUpdatedAt: "2026-07-03T00:00:00.000Z",
      savedAt: new Date("2026-07-03T00:10:00.000Z"),
      values: createValues({ markdown: "# Local draft" }),
    });

    expect(writeArticleLocalDraft(storage, "draft-key", record)).toBe(true);
    expect(readArticleLocalDraft(storage, "draft-key")).toEqual(record);
  });

  it("ignores invalid stored records", () => {
    const storage = createMemoryStorage();

    storage.setItem(
      "draft-key",
      JSON.stringify({ version: 1, values: { title: "missing fields" } }),
    );

    expect(readArticleLocalDraft(storage, "draft-key")).toBeNull();
  });

  it("restores only when the local draft is newer than the server article", () => {
    const newerDraft = createArticleLocalDraftRecord({
      savedAt: new Date("2026-07-03T00:10:00.000Z"),
      values: createValues(),
    });
    const olderDraft = createArticleLocalDraftRecord({
      savedAt: new Date("2026-07-03T00:01:00.000Z"),
      values: createValues(),
    });

    expect(shouldRestoreArticleLocalDraft(newerDraft, "2026-07-03T00:05:00.000Z")).toBe(true);
    expect(shouldRestoreArticleLocalDraft(olderDraft, "2026-07-03T00:05:00.000Z")).toBe(false);
    expect(shouldRestoreArticleLocalDraft(olderDraft, null)).toBe(true);
  });

  it("treats tag ordering as equivalent", () => {
    expect(
      areArticleEditorValuesEqual(
        createValues({ tagSlugs: ["markdown", "ddd"] }),
        createValues({ tagSlugs: ["ddd", "markdown"] }),
      ),
    ).toBe(true);
  });

  it("selects the newest restorable draft across local and cloud candidates", () => {
    const serverValues = createValues({ markdown: "# Server" });

    expect(
      pickLatestRestorableArticleDraft(
        [
          {
            source: "local",
            savedAt: "2026-07-03T00:10:00.000Z",
            values: createValues({ markdown: "# Local" }),
          },
          {
            source: "cloud",
            savedAt: "2026-07-03T00:12:00.000Z",
            values: createValues({ markdown: "# Cloud" }),
          },
        ],
        serverValues,
        "2026-07-03T00:05:00.000Z",
      ),
    ).toMatchObject({
      source: "cloud",
      values: expect.objectContaining({ markdown: "# Cloud" }),
    });
  });

  it("ignores drafts older than the server article or equal to server values", () => {
    const serverValues = createValues({ markdown: "# Server" });

    expect(
      pickLatestRestorableArticleDraft(
        [
          {
            source: "local",
            savedAt: "2026-07-03T00:01:00.000Z",
            values: createValues({ markdown: "# Local" }),
          },
          {
            source: "cloud",
            savedAt: "2026-07-03T00:12:00.000Z",
            values: serverValues,
          },
        ],
        serverValues,
        "2026-07-03T00:05:00.000Z",
      ),
    ).toBeUndefined();
  });

  it("does not throw when storage is unavailable", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    } as unknown as Storage;

    expect(readArticleLocalDraft(storage, "draft-key")).toBeNull();
    expect(
      writeArticleLocalDraft(
        storage,
        "draft-key",
        createArticleLocalDraftRecord({ values: createValues() }),
      ),
    ).toBe(false);
    expect(removeArticleLocalDraft(storage, "draft-key")).toBe(false);
  });
});

function createValues(overrides: Partial<ArticleEditorValues> = {}): ArticleEditorValues {
  return {
    categorySlug: "",
    coverImageUrl: "",
    description: "Description",
    markdown: "# Markdown",
    status: "DRAFT",
    tagSlugs: [],
    title: "Title",
    ...overrides,
  };
}

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
