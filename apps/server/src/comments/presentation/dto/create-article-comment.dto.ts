import { Transform } from "class-transformer";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

class CreateArticleCommentDto {
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MinLength(1)
  @MaxLength(1000)
  body!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string | null;
}

export { CreateArticleCommentDto };
