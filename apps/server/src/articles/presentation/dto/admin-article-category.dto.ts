import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import type {
  AdminArticleCategoryListQuery,
  CreateAdminArticleCategoryRequest,
  UpdateAdminArticleCategoryRequest,
} from "@adrian-zephyr-notes/contracts";

class AdminArticleCategoryListQueryDto implements AdminArticleCategoryListQuery {
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
}

class CreateAdminArticleCategoryDto implements CreateAdminArticleCategoryRequest {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(80)
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

class UpdateAdminArticleCategoryDto implements UpdateAdminArticleCategoryRequest {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export {
  AdminArticleCategoryListQueryDto,
  CreateAdminArticleCategoryDto,
  UpdateAdminArticleCategoryDto,
};
