import { describe, expect, it } from "vitest";
import { shouldAcceptAdminArticleEditorDraftSave } from "./admin-article-editor-draft-save-policy";

describe("shouldAcceptAdminArticleEditorDraftSave", () => {
  it("accepts newer and same-time draft saves", () => {
    expect(
      shouldAcceptAdminArticleEditorDraftSave({
        existingSavedAt: new Date("2026-07-03T10:00:00.000Z"),
        incomingSavedAt: new Date("2026-07-03T10:01:00.000Z"),
      }),
    ).toBe(true);
    expect(
      shouldAcceptAdminArticleEditorDraftSave({
        existingSavedAt: new Date("2026-07-03T10:00:00.000Z"),
        incomingSavedAt: new Date("2026-07-03T10:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("rejects stale autosave requests that arrive after newer drafts", () => {
    expect(
      shouldAcceptAdminArticleEditorDraftSave({
        existingSavedAt: new Date("2026-07-03T10:02:00.000Z"),
        incomingSavedAt: new Date("2026-07-03T10:01:00.000Z"),
      }),
    ).toBe(false);
  });
});
