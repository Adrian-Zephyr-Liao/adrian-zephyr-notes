import { describe, expect, it } from "vitest";
import type { AdminOperationLogAction } from "@adrian-zephyr-notes/contracts";
import {
  formatAuditClientLabel,
  formatAuditMetadataEntries,
  formatAuditResourceLabel,
  formatAuditSummary,
} from "./audit-metadata";

describe("formatAuditMetadataEntries", () => {
  it("formats ordinary moderation metadata in a stable scan order", () => {
    expect(
      formatAuditMetadataEntries({
        articleSlug: "markdown",
        status: "VISIBLE",
        targetId: "comment-1",
      }),
    ).toEqual([
      { key: "status", label: "评论状态", value: "可见" },
      { key: "targetId", label: "目标评论", value: "comment-1" },
      { key: "articleSlug", label: "文章", value: "markdown" },
    ]);
  });

  it("omits unknown fields and non-scalar display values", () => {
    expect(
      formatAuditMetadataEntries({
        nested: { secret: "hidden" },
        retryCount: 2,
        status: { secret: "hidden" },
      }),
    ).toEqual([]);
  });

  it("shortens UUID-like resource identifiers", () => {
    expect(
      formatAuditMetadataEntries({
        targetIds: ["77649607-fadb-4d24-b5f4-bca8ae2ce7d7", "comment-2"],
      }),
    ).toEqual([{ key: "targetIds", label: "目标评论", value: "77649607...、comment-2" }]);
  });
});

describe("audit presentation helpers", () => {
  it("formats comment and article summaries in business language", () => {
    expect(formatAuditSummary(createLog({ metadata: { status: "HIDDEN" } }))).toBe(
      "评论已设为已隐藏",
    );
    expect(
      formatAuditSummary(
        createLog({
          action: "ARTICLE_UPDATED",
          metadata: { articleTitle: "测试文章" },
        }),
      ),
    ).toBe("更新文章 《测试文章》");
    expect(formatAuditSummary(createLog({ action: "ARTICLE_TAG_MERGED" }))).toBe("合并文章标签");
  });

  it("formats ordinary resource and client details", () => {
    const log = createLog({
      resourceId: "77649607-fadb-4d24-b5f4-bca8ae2ce7d7",
      userAgent: "Mozilla/5.0 Chrome/149.0.0.0 Safari/537.36",
      ipAddress: "::ffff:127.0.0.1",
    });
    expect(formatAuditResourceLabel(log)).toBe("评论 / 77649607...");
    expect(formatAuditClientLabel(log)).toBe("管理后台 · 浏览器 · 本机");
    expect(formatAuditClientLabel(createLog())).toBe("管理后台 · 未知客户端 · 未知网络");
  });

  it("preserves summaries of unknown ordinary operations", () => {
    expect(
      formatAuditSummary(
        createLog({
          action: "UNKNOWN_ADMIN_ACTION" as AdminOperationLogAction,
          summary: "同步审计投影",
        }),
      ),
    ).toBe("同步审计投影");
  });
});

function createLog(
  overrides: Partial<Parameters<typeof formatAuditSummary>[0]> = {},
): Parameters<typeof formatAuditSummary>[0] {
  return {
    action: "COMMENT_STATUS_UPDATED",
    actorLogin: "Adrian-Zephyr-Liao",
    createdAt: "2026-07-07T15:57:00.000Z",
    id: "log-1",
    ipAddress: null,
    metadata: null,
    resourceId: null,
    resourceType: "article_comment",
    summary: "Updated article comment status to HIDDEN",
    userAgent: null,
    ...overrides,
  };
}
