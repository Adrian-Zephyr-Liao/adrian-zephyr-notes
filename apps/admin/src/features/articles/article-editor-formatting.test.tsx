// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleWritingSurface, type ArticleEditorValues } from "./article-editor";

const emptyValues: ArticleEditorValues = {
  title: "写作工具",
  markdown: "",
  categorySlug: "",
  coverImageUrl: "",
  description: "",
  origin: "ORIGINAL",
  sourceAuthor: "",
  sourceName: "",
  sourceUrl: "",
  status: "DRAFT",
  tagSlugs: [],
};

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Editor({ markdown }: { markdown: string }) {
  const [values, setValues] = useState({ ...emptyValues, markdown });
  return (
    <ArticleWritingSurface
      editorMode="edit"
      isLoading={false}
      taxonomyOptions={{ categories: [], tags: [] }}
      values={values}
      onChange={setValues}
    />
  );
}
function source() {
  return screen.getByRole("textbox", { name: "Markdown 内容" }) as HTMLTextAreaElement;
}

describe("Markdown writing controls", () => {
  it("formats the selected text and restores editing focus without changing the rest", async () => {
    render(<Editor markdown="first second" />);
    source().setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "加粗" }));
    expect(source().value).toBe("**first** second");
    await waitFor(() => expect(document.activeElement).toBe(source()));
    expect(source().value.slice(source().selectionStart, source().selectionEnd)).toBe("first");
  });
  it("applies headings to the selected complete lines", () => {
    render(<Editor markdown={"first\nsecond\nthird"} />);
    source().setSelectionRange(2, 9);
    fireEvent.click(screen.getByRole("button", { name: "二级标题" }));
    expect(source().value).toBe("## first\n## second\nthird");
  });
  it("selects the inserted link destination for immediate editing", async () => {
    render(<Editor markdown="first" />);
    source().setSelectionRange(0, 5);
    fireEvent.click(screen.getByRole("button", { name: "插入链接" }));
    expect(source().value).toBe("[first](https://)");
    await waitFor(() =>
      expect(source().value.slice(source().selectionStart, source().selectionEnd)).toBe("https://"),
    );
  });
  it("supports keyboard emphasis while preserving composition input", () => {
    render(<Editor markdown="first" />);
    source().setSelectionRange(0, 5);
    fireEvent.keyDown(source(), { key: "b", ctrlKey: true, isComposing: true });
    expect(source().value).toBe("first");
    fireEvent.keyDown(source(), { key: "i", ctrlKey: true });
    expect(source().value).toBe("*first*");
  });
});
