import { IsOptional, IsString } from "class-validator";

class AdminArticleEditorDraftQueryDto {
  @IsOptional()
  @IsString()
  articleId?: string;
}

export { AdminArticleEditorDraftQueryDto };
