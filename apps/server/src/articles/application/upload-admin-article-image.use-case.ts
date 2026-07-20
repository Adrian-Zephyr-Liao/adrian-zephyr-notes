import type { AdminArticleImageUploadResponse } from "@adrian-zephyr-notes/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ARTICLE_IMAGE_STORAGE, type ArticleImageStorage } from "../domain/article-image-storage";

const ARTICLE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

type ArticleImageType = {
  extension: "gif" | "jpeg" | "png" | "webp";
  mimeType: "image/gif" | "image/jpeg" | "image/png" | "image/webp";
};

type UploadAdminArticleImageInput = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

type ArticleImageValidationErrorCode =
  | "ARTICLE_IMAGE_EMPTY"
  | "ARTICLE_IMAGE_TOO_LARGE"
  | "ARTICLE_IMAGE_TYPE_MISMATCH"
  | "ARTICLE_IMAGE_TYPE_UNSUPPORTED";

class ArticleImageValidationError extends Error {
  constructor(
    readonly code: ArticleImageValidationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
class UploadAdminArticleImageUseCase {
  constructor(
    @Inject(ARTICLE_IMAGE_STORAGE)
    private readonly storage: ArticleImageStorage,
  ) {}

  async execute(input: UploadAdminArticleImageInput): Promise<AdminArticleImageUploadResponse> {
    validateArticleImageSize(input.buffer);
    const imageType = detectArticleImageType(input.buffer);

    if (!imageType) {
      throw new ArticleImageValidationError(
        "ARTICLE_IMAGE_TYPE_UNSUPPORTED",
        "仅支持 JPEG、PNG、WebP 和 GIF 图片。",
      );
    }

    const providedMimeType = normalizeMimeType(input.mimeType);

    if (providedMimeType && providedMimeType !== imageType.mimeType) {
      throw new ArticleImageValidationError(
        "ARTICLE_IMAGE_TYPE_MISMATCH",
        "图片扩展信息与实际内容不一致，请重新导出后上传。",
      );
    }

    const key = createArticleImageObjectKey(imageType.extension, new Date(), randomUUID());
    const stored = await this.storage.put({
      body: input.buffer,
      key,
      mimeType: imageType.mimeType,
    });

    return {
      key: stored.key,
      mimeType: imageType.mimeType,
      originalName: normalizeOriginalName(input.originalName, imageType.extension),
      size: input.buffer.length,
      url: stored.url,
    };
  }
}

function validateArticleImageSize(buffer: Buffer) {
  if (buffer.length === 0) {
    throw new ArticleImageValidationError("ARTICLE_IMAGE_EMPTY", "请选择非空图片文件。");
  }

  if (buffer.length > ARTICLE_IMAGE_MAX_BYTES) {
    throw new ArticleImageValidationError("ARTICLE_IMAGE_TOO_LARGE", "图片不能超过 10 MB。");
  }
}

function detectArticleImageType(buffer: Buffer): ArticleImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { extension: "jpeg", mimeType: "image/jpeg" };
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (buffer.length >= 6) {
    const signature = buffer.subarray(0, 6).toString("ascii");

    if (signature === "GIF87a" || signature === "GIF89a") {
      return { extension: "gif", mimeType: "image/gif" };
    }
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  return null;
}

function createArticleImageObjectKey(
  extension: ArticleImageType["extension"],
  now: Date,
  id: string,
) {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return `articles/${year}/${month}/${id}.${extension}`;
}

function normalizeMimeType(value: string) {
  return value.split(";", 1)[0]?.trim().toLowerCase();
}

function normalizeOriginalName(value: string, extension: string) {
  const basename = value
    .split(/[\\/]/)
    .pop()
    ?.split("")
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f ? " " : character;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
  return basename || `image.${extension}`;
}

export {
  ARTICLE_IMAGE_MAX_BYTES,
  ArticleImageValidationError,
  UploadAdminArticleImageUseCase,
  createArticleImageObjectKey,
  detectArticleImageType,
};
