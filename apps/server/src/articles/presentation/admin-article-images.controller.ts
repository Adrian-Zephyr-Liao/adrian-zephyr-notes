import type { AdminArticleImageUploadResponse } from "@adrian-zephyr-notes/contracts";
import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import {
  ArticleImageStorageError,
  ArticleImageStorageUnavailableError,
} from "../application/article-image-upload.errors";
import {
  ARTICLE_IMAGE_MAX_BYTES,
  ArticleImageValidationError,
  UploadAdminArticleImageUseCase,
} from "../application/upload-admin-article-image.use-case";

type UploadedArticleImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

@Controller("api/admin/articles")
@UseGuards(AdminAuthGuard)
class AdminArticleImagesController {
  constructor(private readonly uploadAdminArticleImage: UploadAdminArticleImageUseCase) {}

  @Post("images")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: ARTICLE_IMAGE_MAX_BYTES,
        files: 1,
      },
    }),
  )
  async upload(
    @UploadedFile() file: UploadedArticleImage | undefined,
  ): Promise<AdminArticleImageUploadResponse> {
    if (!file) {
      throw createArticleImageHttpError(
        new ArticleImageValidationError("ARTICLE_IMAGE_EMPTY", "请选择要上传的图片。"),
      );
    }

    try {
      return await this.uploadAdminArticleImage.execute({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      });
    } catch (error) {
      throw createArticleImageHttpError(error);
    }
  }
}

function createArticleImageHttpError(error: unknown) {
  if (error instanceof ArticleImageValidationError) {
    return new BadRequestException({
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  if (error instanceof ArticleImageStorageUnavailableError) {
    return new ServiceUnavailableException({
      error: {
        code: "ARTICLE_IMAGE_STORAGE_UNAVAILABLE",
        message: error.message,
      },
    });
  }

  if (error instanceof ArticleImageStorageError) {
    return new BadGatewayException({
      error: {
        code: "ARTICLE_IMAGE_UPLOAD_FAILED",
        message: "图片暂时无法上传，请稍后重试。",
      },
    });
  }

  return error;
}

export { AdminArticleImagesController, createArticleImageHttpError };
