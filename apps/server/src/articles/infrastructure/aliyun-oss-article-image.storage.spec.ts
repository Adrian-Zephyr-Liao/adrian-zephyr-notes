import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import {
  ArticleImageStorageError,
  ArticleImageStorageUnavailableError,
} from "../application/article-image-upload.errors";
import {
  AliyunOssArticleImageStorage,
  type ArticleImageOssClient,
  type ArticleImageOssClientFactory,
} from "./aliyun-oss-article-image.storage";

describe("AliyunOssArticleImageStorage", () => {
  it("uploads immutable content and returns the configured CDN URL", async () => {
    const put = vi.fn().mockResolvedValue({});
    const createClient = vi.fn().mockResolvedValue({ put } satisfies ArticleImageOssClient);
    const storage = new AliyunOssArticleImageStorage(
      createConfigService({
        OSS_BUCKET: "zephyrai-images",
        OSS_INTERNAL: "false",
        OSS_PUBLIC_BASE_URL: "https://img.zephyrai.site/",
        OSS_REGION: "oss-cn-hangzhou",
      }),
      createClient,
    );
    const body = Buffer.from("image");

    await expect(
      storage.put({
        body,
        key: "articles/2026/07/example.png",
        mimeType: "image/png",
      }),
    ).resolves.toEqual({
      key: "articles/2026/07/example.png",
      url: "https://img.zephyrai.site/articles/2026/07/example.png",
    });

    expect(createClient).toHaveBeenCalledWith({
      bucket: "zephyrai-images",
      internal: false,
      region: "oss-cn-hangzhou",
    });
    expect(put).toHaveBeenCalledWith("articles/2026/07/example.png", body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/png",
      },
    });
  });

  it("reports missing or insecure configuration without contacting OSS", async () => {
    const createClient = vi.fn() as unknown as ArticleImageOssClientFactory;

    await expect(
      new AliyunOssArticleImageStorage(createConfigService({}), createClient).put({
        body: Buffer.from("image"),
        key: "articles/image.png",
        mimeType: "image/png",
      }),
    ).rejects.toBeInstanceOf(ArticleImageStorageUnavailableError);

    await expect(
      new AliyunOssArticleImageStorage(
        createConfigService({
          OSS_BUCKET: "zephyrai-images",
          OSS_PUBLIC_BASE_URL: "http://img.zephyrai.site",
          OSS_REGION: "oss-cn-hangzhou",
        }),
        createClient,
      ).put({
        body: Buffer.from("image"),
        key: "articles/image.png",
        mimeType: "image/png",
      }),
    ).rejects.toBeInstanceOf(ArticleImageStorageUnavailableError);

    expect(createClient).not.toHaveBeenCalled();
  });

  it("maps provider failures to a stable storage error", async () => {
    const storage = new AliyunOssArticleImageStorage(
      createConfigService({
        OSS_BUCKET: "zephyrai-images",
        OSS_PUBLIC_BASE_URL: "https://img.zephyrai.site",
        OSS_REGION: "oss-cn-hangzhou",
      }),
      vi.fn().mockRejectedValue(new Error("provider details")),
    );

    await expect(
      storage.put({
        body: Buffer.from("image"),
        key: "articles/image.png",
        mimeType: "image/png",
      }),
    ).rejects.toBeInstanceOf(ArticleImageStorageError);
  });
});

function createConfigService(values: Record<string, string>) {
  return {
    get: vi.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}
