import { IsArray, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type { CreateAdminArticleRequest } from "@adrian-zephyr-notes/contracts";

class CreateAdminArticleDto implements CreateAdminArticleRequest {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsString()
  markdown!: string;

  @IsOptional()
  @IsIn(["ARCHIVED", "DRAFT", "PUBLISHED"])
  status?: CreateAdminArticleRequest["status"];

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

  @IsOptional()
  @IsIn(["ORIGINAL", "REPOSTED"])
  origin?: CreateAdminArticleRequest["origin"];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  sourceAuthor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  sourceUrl?: string | null;
}

export { CreateAdminArticleDto };
