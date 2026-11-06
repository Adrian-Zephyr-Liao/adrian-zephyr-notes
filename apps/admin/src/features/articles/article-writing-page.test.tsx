// @vitest-environment jsdom

import type { AdminArticleDetailResponse, AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleWritingPage } from "./article-writing-page";
import {
  createArticleLocalDraftKey,
  createArticleLocalDraftRecord,
  readArticleLocalDraft,
  writeArticleLocalDraft,
} from "./article-local-draft";
import { toEditorValues } from "./article-editor-model";

const api = vi.hoisted(() => ({
  createAdminArticle: vi.fn(),
  deleteAdminArticle: vi.fn(),
  deleteCurrentAdminArticleEditorDraft: vi.fn(),
  getAdminArticle: vi.fn(),
  getCurrentAdminArticleEditorDraft: vi.fn(),
  listAdminArticleTaxonomies: vi.fn(),
  logoutAdmin: vi.fn(),
  saveCurrentAdminArticleEditorDraft: vi.fn(),
  updateAdminArticle: vi.fn(),
  uploadAdminArticleImage: vi.fn(),
}));
const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("../../lib/admin-api", () => ({ ...api, AdminApiError: class extends Error {} }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => router.navigate }));

const admin: AdminUserResponse = {
  id: "admin",
  githubId: "1",
  login: "writer",
  name: null,
  avatarUrl: null,
  profileUrl: "https://github.com/writer",
  role: "ADMIN",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  const items = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
    clear: () => items.clear(),
    key: (index: number) => [...items.keys()][index] ?? null,
    get length() {
      return items.size;
    },
  } satisfies Storage);
  window.localStorage.clear();
  api.listAdminArticleTaxonomies.mockResolvedValue({ categories: [], tags: [] });
  api.getCurrentAdminArticleEditorDraft.mockResolvedValue(null);
  api.getAdminArticle.mockImplementation((id: string) => Promise.resolve(article(id)));
  api.saveCurrentAdminArticleEditorDraft.mockImplementation(async (input) => ({
    ...input,
    id: "draft",
    savedAt: input.clientSavedAt,
  }));
  api.deleteCurrentAdminArticleEditorDraft.mockResolvedValue(undefined);
  router.navigate.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("article writing async safety", () => {
  it("keeps edits made during a save and records the newly committed base", async () => {
    const save = deferred<AdminArticleDetailResponse>();
    api.updateAdminArticle.mockReturnValue(save.promise);
    render(
      <StrictMode>
        <ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />
      </StrictMode>,
    );
    await title("Article a");
    editTitle("Submitted version");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(api.updateAdminArticle).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ title: "Submitted version" }),
    );
    editTitle("Later local version");
    const saved = article("a", { title: "Submitted version", updatedAt: new Date().toISOString() });
    await act(async () => save.resolve(saved));
    expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("Later local version");
    expect(readArticleLocalDraft(window.localStorage, draftKey("a"))).toMatchObject({
      baseArticleUpdatedAt: saved.updatedAt,
      values: { title: "Later local version" },
    });
    expect(api.deleteCurrentAdminArticleEditorDraft).not.toHaveBeenCalled();
    expect(screen.queryByText("已保存")).toBeNull();
  });

  it("does not retain the previous article as a write target when the next load fails", async () => {
    const view = render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
    await title("Article a");
    api.getAdminArticle.mockRejectedValueOnce(new Error("offline"));
    view.rerender(<ArticleWritingPage admin={admin} articleId="b" onLogout={() => {}} />);
    await screen.findByText("写作页加载失败，请检查服务端状态或管理员权限。");
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "删除" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(api.updateAdminArticle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "重新加载文章" }));
    await title("Article b");
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it.each(["success", "failure"] as const)(
    "ignores a late save %s after leaving and revisiting an article",
    async (outcome) => {
      const save = deferred<AdminArticleDetailResponse>();
      api.updateAdminArticle.mockReturnValue(save.promise);
      const view = render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
      await title("Article a");
      editTitle("Pending save");
      fireEvent.click(screen.getByRole("button", { name: "保存" }));
      view.rerender(<ArticleWritingPage admin={admin} articleId="b" onLogout={() => {}} />);
      await title("Article b");
      view.rerender(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
      await title("Pending save");
      editTitle("Revisited draft");
      await act(async () => {
        if (outcome === "success") save.resolve(article("a", { title: "Old committed response" }));
        else save.reject(new Error("late network error"));
      });
      expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("Revisited draft");
      expect(readArticleLocalDraft(window.localStorage, draftKey("a"))?.values.title).toBe(
        "Revisited draft",
      );
      expect(screen.queryByText(/文章保存未获确认/)).toBeNull();
      expect(api.deleteCurrentAdminArticleEditorDraft).not.toHaveBeenCalled();
      expect(router.navigate).not.toHaveBeenCalled();
    },
  );

  it("moves unsaved edits to the created article before navigating", async () => {
    const save = deferred<AdminArticleDetailResponse>();
    api.createAdminArticle.mockReturnValue(save.promise);
    render(<ArticleWritingPage admin={admin} onLogout={() => {}} />);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
    editTitle("New submitted article");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    editTitle("Newer draft after submit");
    const saved = article("created", {
      title: "New submitted article",
      updatedAt: new Date().toISOString(),
    });
    await act(async () => save.resolve(saved));
    expect(readArticleLocalDraft(window.localStorage, draftKey("created"))).toMatchObject({
      articleId: "created",
      baseArticleUpdatedAt: saved.updatedAt,
      values: { title: "Newer draft after submit" },
    });
    expect(readArticleLocalDraft(window.localStorage, draftKey())).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith({
      params: { articleId: "created" },
      replace: true,
      to: "/articles/$articleId/edit",
    });
  });

  it("does not accept new-article input before initial draft restoration finishes", async () => {
    const draft = deferred<null>();
    api.getCurrentAdminArticleEditorDraft.mockReturnValue(draft.promise);
    render(<ArticleWritingPage admin={admin} onLogout={() => {}} />);
    expect(screen.queryByLabelText("标题")).toBeNull();
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => draft.resolve(null));
    expect(screen.getByLabelText("标题")).not.toBeNull();
  });

  it("also preserves new-article edits made while cloud cleanup is pending", async () => {
    const cleanupDraft = deferred<void>();
    api.deleteCurrentAdminArticleEditorDraft.mockReturnValue(cleanupDraft.promise);
    api.createAdminArticle.mockResolvedValue(article("created"));
    render(<ArticleWritingPage admin={admin} onLogout={() => {}} />);
    await screen.findByLabelText("标题");
    editTitle("Submitted new article");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(api.deleteCurrentAdminArticleEditorDraft).toHaveBeenCalled());
    editTitle("Input during draft cleanup");
    await act(async () => cleanupDraft.resolve());
    expect(readArticleLocalDraft(window.localStorage, draftKey("created"))?.values.title).toBe(
      "Input during draft cleanup",
    );
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it("updates the returned article after a navigation failure instead of creating it twice", async () => {
    api.createAdminArticle.mockResolvedValue(article("created"));
    api.updateAdminArticle.mockResolvedValue(article("created", { title: "Retry navigation" }));
    router.navigate.mockRejectedValueOnce(new Error("router unavailable"));
    render(<ArticleWritingPage admin={admin} onLogout={() => {}} />);
    await screen.findByLabelText("标题");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText("文章已保存，页面跳转失败；可返回文章管理继续编辑。");
    editTitle("Retry navigation");
    expect(readArticleLocalDraft(window.localStorage, draftKey())).toBeNull();
    expect(readArticleLocalDraft(window.localStorage, draftKey("created"))?.values.title).toBe(
      "Retry navigation",
    );
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(api.updateAdminArticle).toHaveBeenCalledWith(
        "created",
        expect.objectContaining({ title: "Retry navigation" }),
      ),
    );
    expect(api.createAdminArticle).toHaveBeenCalledTimes(1);
  });

  it("persists input made while navigation to the created article is still pending", async () => {
    const navigation = deferred<void>();
    api.createAdminArticle.mockResolvedValue(article("created"));
    router.navigate.mockReturnValue(navigation.promise);
    const view = render(<ArticleWritingPage admin={admin} onLogout={() => {}} />);
    await screen.findByLabelText("标题");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(router.navigate).toHaveBeenCalledTimes(1));
    editTitle("Typed while navigating");
    expect(readArticleLocalDraft(window.localStorage, draftKey())).toBeNull();
    view.rerender(<ArticleWritingPage admin={admin} articleId="created" onLogout={() => {}} />);
    await title("Typed while navigating");
    await act(async () => navigation.resolve());
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("finishes already-started cloud synchronization before deleting the committed draft", async () => {
    const cloud = deferred<{ savedAt: string }>();
    api.saveCurrentAdminArticleEditorDraft.mockReturnValue(cloud.promise);
    api.updateAdminArticle.mockResolvedValue(
      article("a", { title: "Cloud draft", updatedAt: new Date().toISOString() }),
    );
    render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
    await title("Article a");
    editTitle("Cloud draft");
    await waitFor(() => expect(api.saveCurrentAdminArticleEditorDraft).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await screen.findByText("文章已保存，正在整理草稿");
    expect(api.deleteCurrentAdminArticleEditorDraft).not.toHaveBeenCalled();
    await act(async () => cloud.resolve({ savedAt: new Date().toISOString() }));
    expect(api.deleteCurrentAdminArticleEditorDraft).toHaveBeenCalledWith("a");
    expect(screen.queryByText(/已同步云端草稿/)).toBeNull();
    expect(readArticleLocalDraft(window.localStorage, draftKey("a"))).toBeNull();
  });

  it("keeps an incompatible draft intact until the writer explicitly restores it", async () => {
    const record = createArticleLocalDraftRecord({
      articleId: "a",
      baseArticleUpdatedAt: "2025-01-01T00:00:00.000Z",
      savedAt: new Date("2099-01-01T00:00:00.000Z"),
      values: toEditorValues(article("a", { title: "Old base draft" })),
    });
    writeArticleLocalDraft(window.localStorage, draftKey("a"), record);
    render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
    await title("Article a");
    expect(readArticleLocalDraft(window.localStorage, draftKey("a"))).toEqual(record);
    fireEvent.click(screen.getByRole("button", { name: "恢复旧版本草稿" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "恢复草稿" }));
    await title("Old base draft");
    expect(readArticleLocalDraft(window.localStorage, draftKey("a"))).toMatchObject({
      baseArticleUpdatedAt: article("a").updatedAt,
    });
    expect(api.updateAdminArticle).not.toHaveBeenCalled();
  });

  it("ignores a delete completion after the writer has moved to another article", async () => {
    const deletion = deferred<void>();
    api.deleteAdminArticle.mockReturnValue(deletion.promise);
    const view = render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
    await title("Article a");
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "删除文章" }));
    await waitFor(() => expect(api.deleteAdminArticle).toHaveBeenCalledWith("a"));
    view.rerender(<ArticleWritingPage admin={admin} articleId="b" onLogout={() => {}} />);
    await title("Article b");
    await act(async () => deletion.resolve());
    expect(router.navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("Article b");
  });

  it("ignores an image upload callback from an earlier visit before it can overwrite storage", async () => {
    const upload = deferred<{ originalName: string; url: string }>();
    api.uploadAdminArticleImage.mockReturnValue(upload.promise);
    const view = render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
    await title("Article a");
    const input = view.container.querySelector('input[type="file"]')!;
    fireEvent.change(input, {
      target: { files: [new File(["image"], "note.png", { type: "image/png" })] },
    });
    expect(api.uploadAdminArticleImage).toHaveBeenCalledTimes(1);
    view.rerender(<ArticleWritingPage admin={admin} articleId="b" onLogout={() => {}} />);
    await title("Article b");
    view.rerender(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
    await title("Article a");
    editTitle("Current visit draft");
    await act(async () =>
      upload.resolve({ originalName: "note.png", url: "https://example.test/note.png" }),
    );
    expect(readArticleLocalDraft(window.localStorage, draftKey("a"))?.values.title).toBe(
      "Current visit draft",
    );
    expect(
      readArticleLocalDraft(window.localStorage, draftKey("a"))?.values.markdown,
    ).not.toContain("note.png");
  });
  it("keeps a confirmed deletion distinct from a failed redirect and closes the editor", async () => {
    api.deleteAdminArticle.mockResolvedValue(undefined);
    router.navigate.mockRejectedValueOnce(new Error("navigation failed"));
    render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
    await title("Article a");
    editTitle("Local draft before deleting");
    fireEvent.click(screen.getByRole("button", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "删除文章" }));
    await screen.findByText("文章已删除，页面跳转失败；可返回文章管理。");
    expect(screen.queryByLabelText("标题")).toBeNull();
    expect(readArticleLocalDraft(window.localStorage, draftKey("a"))).toBeNull();
    expect((screen.getByRole("button", { name: "保存" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/文章删除未获确认/)).toBeNull();
  });
  it.each(["save", "restore"] as const)(
    "requires a fresh %s confirmation when an upload changes content inside the dialog",
    async (operation) => {
      if (operation === "restore") {
        writeArticleLocalDraft(
          window.localStorage,
          draftKey("a"),
          createArticleLocalDraftRecord({
            articleId: "a",
            baseArticleUpdatedAt: "2025-01-01T00:00:00.000Z",
            values: toEditorValues(article("a", { title: "Older conflicting draft" })),
          }),
        );
      } else {
        writeArticleLocalDraft(
          window.localStorage,
          draftKey("a"),
          createArticleLocalDraftRecord({
            articleId: "a",
            baseArticleUpdatedAt: article("a").updatedAt,
            values: toEditorValues(article("a", { status: "PUBLISHED" })),
          }),
        );
      }
      const upload = deferred<{ originalName: string; url: string }>();
      api.uploadAdminArticleImage.mockReturnValue(upload.promise);
      const view = render(<ArticleWritingPage admin={admin} articleId="a" onLogout={() => {}} />);
      await title("Article a");
      fireEvent.change(view.container.querySelector('input[type="file"]')!, {
        target: { files: [new File(["image"], "note.png", { type: "image/png" })] },
      });
      fireEvent.click(
        screen.getByRole("button", { name: operation === "save" ? "保存" : "恢复旧版本草稿" }),
      );
      const dialog = await screen.findByRole("alertdialog");
      await act(async () =>
        upload.resolve({ originalName: "note.png", url: "https://example.test/note.png" }),
      );
      fireEvent.click(
        within(dialog).getByRole("button", {
          name: operation === "save" ? "确认发布" : "恢复草稿",
        }),
      );
      await screen.findByText(
        operation === "save"
          ? "确认期间内容已变化，请重新保存并确认。"
          : "确认期间内容已变化，请重新核对后恢复草稿。",
      );
      expect((screen.getByLabelText("Markdown 内容") as HTMLTextAreaElement).value).toContain(
        "https://example.test/note.png",
      );
      expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe("Article a");
      expect(api.updateAdminArticle).not.toHaveBeenCalled();
    },
  );
});

function editTitle(value: string) {
  fireEvent.change(screen.getByLabelText("标题"), { target: { value } });
}
async function title(value: string) {
  await waitFor(() =>
    expect((screen.getByLabelText("标题") as HTMLInputElement).value).toBe(value),
  );
}
function draftKey(articleId?: string) {
  return createArticleLocalDraftKey({ adminLogin: admin.login, articleId });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function article(
  id: string,
  overrides: Partial<AdminArticleDetailResponse> = {},
): AdminArticleDetailResponse {
  return {
    id,
    slug: id,
    title: `Article ${id}`,
    description: "Description",
    markdown: "# Article\n\nText.",
    origin: "ORIGINAL",
    source: null,
    status: "DRAFT",
    category: null,
    tags: [],
    coverImageUrl: null,
    wordCount: 2,
    readingMinutes: 1,
    commentCount: 0,
    aiSummaryStatus: "UNQUEUED",
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
