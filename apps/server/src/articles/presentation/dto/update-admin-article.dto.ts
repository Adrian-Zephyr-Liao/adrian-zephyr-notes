import { IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { UpdateAdminArticleRequest } from "@adrian-zephyr-notes/contracts";

class UpdateAdminArticleDto implements UpdateAdminArticleRequest {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  markdown?: string;

  @IsOptional()
  @IsIn(["ARCHIVED", "DRAFT", "PUBLISHED"])
  status?: UpdateAdminArticleRequest["status"];

  @IsOptional()
  @IsString()
  categorySlug?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagSlugs?: string[];

  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;
}

export { UpdateAdminArticleDto };
