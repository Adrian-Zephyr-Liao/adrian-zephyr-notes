import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

class ArticleCommentsQueryDto {
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
}

export { ArticleCommentsQueryDto };
