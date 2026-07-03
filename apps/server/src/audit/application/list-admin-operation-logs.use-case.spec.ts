import { describe, expect, it } from "vitest";
import { normalizeListAdminOperationLogsInput } from "./list-admin-operation-logs.use-case";

describe("normalizeListAdminOperationLogsInput", () => {
  it("normalizes pagination and optional text filters", () => {
    expect(
      normalizeListAdminOperationLogsInput({
        actorLogin: "  Adrian-Zephyr-Liao  ",
        page: 2,
        pageSize: 500,
        search: "  article  ",
      }),
    ).toEqual({
      actorLogin: "Adrian-Zephyr-Liao",
      page: 2,
      pageSize: 50,
      search: "article",
      action: undefined,
    });
  });

  it("keeps only supported audit actions", () => {
    expect(normalizeListAdminOperationLogsInput({ action: "ARTICLE_UPDATED" }).action).toBe(
      "ARTICLE_UPDATED",
    );
    expect(normalizeListAdminOperationLogsInput({ action: "ALL" }).action).toBeUndefined();
    expect(normalizeListAdminOperationLogsInput({ action: "UNKNOWN" }).action).toBeUndefined();
  });
});
