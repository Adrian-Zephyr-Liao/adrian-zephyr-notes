import { describe, expect, it } from "vitest";
import {
  sanitizeAdminOperationLogMetadata,
  toAdminOperationLogResponse,
} from "./admin-operation-log.mapper";

describe("audit response mapping", () => {
  it("preserves ordinary business summaries and publishes only supported metadata", () => {
    expect(
      toAdminOperationLogResponse({
        action: "ARTICLE_UPDATED",
        actorLogin: "reviewer",
        actorUserId: "admin-1",
        createdAt: new Date("2026-07-09T08:00:00.000Z"),
        id: "log-1",
        ipAddress: "::1",
        metadata: {
          articleSlug: "hello-world",
          articleTitle: "Hello World",
          status: "PUBLISHED",
          secret: "must-not-leak",
          diagnostic: { details: "private" },
        },
        resourceId: "article-1",
        resourceType: "article",
        summary: "更新文章《Hello World》",
        userAgent: "curl/8.0.0",
      }),
    ).toEqual({
      action: "ARTICLE_UPDATED",
      actorLogin: "reviewer",
      createdAt: "2026-07-09T08:00:00.000Z",
      id: "log-1",
      ipAddress: "::1",
      metadata: { articleSlug: "hello-world", articleTitle: "Hello World", status: "PUBLISHED" },
      resourceId: "article-1",
      resourceType: "article",
      summary: "更新文章《Hello World》",
      userAgent: "curl/8.0.0",
    });
  });

  it("returns null for absent or unsupported metadata", () => {
    expect(sanitizeAdminOperationLogMetadata(null)).toBeNull();
    expect(sanitizeAdminOperationLogMetadata({ diagnostic: "private" })).toBeNull();
    expect(sanitizeAdminOperationLogMetadata({ targetIds: [] })).toBeNull();
  });
});
