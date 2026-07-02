import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { ARTICLE_COMMENT_BODY_MAX_LENGTH } from "../../domain/article-comment.entity";

class CreateArticleCommentDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1)
  @MaxLength(ARTICLE_COMMENT_BODY_MAX_LENGTH)
  body!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string | null;
}

export { CreateArticleCommentDto };
