import { describe, expect, it, vi } from "vitest";
import type { ArticleImageStorage } from "../domain/article-image-storage";
import {
  ARTICLE_IMAGE_MAX_BYTES,
  ArticleImageValidationError,
  UploadAdminArticleImageUseCase,
  createArticleImageObjectKey,
  detectArticleImageType,
} from "./upload-admin-article-image.use-case";

describe("UploadAdminArticleImageUseCase", () => {
  it.each([
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0])],
    ["image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/gif", Buffer.from("GIF89a")],
    ["image/webp", Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])],
  ] as const)("detects %s from the file signature", (mimeType, buffer) => {
    expect(detectArticleImageType(buffer)).toMatchObject({ mimeType });
  });

  it("uploads verified bytes with an immutable random object key", async () => {
    const storage = createStorageDouble();
    const useCase = new UploadAdminArticleImageUseCase(storage);
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const result = await useCase.execute({
      buffer,
      mimeType: "image/png",
      originalName: "architecture.png",
    });

    expect(storage.put).toHaveBeenCalledWith({
      body: buffer,
      key: expect.stringMatching(/^articles\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/),
      mimeType: "image/png",
    });
    expect(result).toMatchObject({
      mimeType: "image/png",
      originalName: "architecture.png",
      size: buffer.length,
    });
  });

  it("rejects MIME and signature mismatches", async () => {
    const useCase = new UploadAdminArticleImageUseCase(createStorageDouble());

    await expect(
      useCase.execute({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        mimeType: "image/png",
        originalName: "renamed.png",
      }),
    ).rejects.toMatchObject({ code: "ARTICLE_IMAGE_TYPE_MISMATCH" });
  });

  it("accepts an omitted browser MIME type when the signature is supported", async () => {
    const useCase = new UploadAdminArticleImageUseCase(createStorageDouble());

    await expect(
      useCase.execute({
        buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        mimeType: "",
        originalName: "photo.jpg",
      }),
    ).resolves.toMatchObject({ mimeType: "image/jpeg" });
  });

  it("rejects unsupported and oversized payloads", async () => {
    const useCase = new UploadAdminArticleImageUseCase(createStorageDouble());

    await expect(
      useCase.execute({
        buffer: Buffer.from("not an image"),
        mimeType: "image/svg+xml",
        originalName: "unsafe.svg",
      }),
    ).rejects.toBeInstanceOf(ArticleImageValidationError);

    await expect(
      useCase.execute({
        buffer: Buffer.alloc(ARTICLE_IMAGE_MAX_BYTES + 1),
        mimeType: "image/png",
        originalName: "large.png",
      }),
    ).rejects.toMatchObject({ code: "ARTICLE_IMAGE_TOO_LARGE" });
  });

  it("creates deterministic month partitions without a time-sortable id", () => {
    expect(
      createArticleImageObjectKey(
        "png",
        new Date("2026-07-21T08:00:00.000Z"),
        "c4d40a0f-0584-4da9-9889-4fcfa1dc75f7",
      ),
    ).toBe("articles/2026/07/c4d40a0f-0584-4da9-9889-4fcfa1dc75f7.png");
  });
});

function createStorageDouble() {
  return {
    put: vi.fn(async ({ key }: { key: string }) => ({
      key,
      url: `https://img.zephyrai.site/${key}`,
    })),
  } as unknown as ArticleImageStorage & { put: ReturnType<typeof vi.fn> };
}
