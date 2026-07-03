import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

class AdminOperationLogListQueryDto {
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
  @IsIn([
    "ALL",
    "ARTICLE_CREATED",
    "ARTICLE_DELETED",
    "ARTICLE_UPDATED",
    "COMMENT_STATUS_UPDATED",
    "GUESTBOOK_MESSAGE_UPDATED",
    "SITE_ANNOUNCEMENT_UPDATED",
    "SITE_SETTINGS_UPDATED",
  ])
  action?: string;

  @IsOptional()
  @IsString()
  actorLogin?: string;

  @IsOptional()
  @IsString()
  q?: string;
}

export { AdminOperationLogListQueryDto };
