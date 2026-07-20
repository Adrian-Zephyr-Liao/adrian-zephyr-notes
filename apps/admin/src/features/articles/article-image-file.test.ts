import { describe, expect, it } from "vitest";
import { ARTICLE_IMAGE_MAX_BYTES, getArticleImageFileError } from "./article-image-file";

describe("article image file validation", () => {
  it("accepts supported images within the upload limit", () => {
    expect(getArticleImageFileError({ size: 1024, type: "image/webp" })).toBeNull();
    expect(getArticleImageFileError({ size: 1024, type: "" })).toBeNull();
  });

  it("rejects empty, oversized, and unsupported files", () => {
    expect(getArticleImageFileError({ size: 0, type: "image/png" })).toBe("请选择非空图片文件。");
    expect(getArticleImageFileError({ size: ARTICLE_IMAGE_MAX_BYTES + 1, type: "image/png" })).toBe(
      "图片不能超过 10 MB。",
    );
    expect(getArticleImageFileError({ size: 1024, type: "image/svg+xml" })).toBe(
      "仅支持 JPEG、PNG、WebP 和 GIF 图片。",
    );
  });
});
