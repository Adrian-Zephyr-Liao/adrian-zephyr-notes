import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";

class AdminArticleCommentListQueryDto {
  @IsOptional()
  @IsUUID()
  commentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(["ALL", "HIDDEN", "VISIBLE"])
  status?: string;
}

export { AdminArticleCommentListQueryDto };
