import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

class AdminArticleTagListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(160) q?: string;
}

class CreateAdminArticleTagDto {
  @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @IsString() @MinLength(1) @MaxLength(80) slug!: string;
}

class UpdateAdminArticleTagDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(80) slug?: string;
}

class MergeAdminArticleTagDto {
  @IsUUID() targetTagId!: string;
}

export {
  AdminArticleTagListQueryDto,
  CreateAdminArticleTagDto,
  MergeAdminArticleTagDto,
  UpdateAdminArticleTagDto,
};
