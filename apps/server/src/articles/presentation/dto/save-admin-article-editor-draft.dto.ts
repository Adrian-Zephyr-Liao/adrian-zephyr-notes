import { Type } from "class-transformer";
import { IsArray, IsDefined, IsIn, IsOptional, IsString, ValidateNested } from "class-validator";
import type {
  AdminArticleEditorDraftValues,
  SaveAdminArticleEditorDraftRequest,
} from "@adrian-zephyr-notes/contracts";

class AdminArticleEditorDraftValuesDto implements AdminArticleEditorDraftValues {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  markdown!: string;

  @IsIn(["ARCHIVED", "DRAFT", "PUBLISHED"])
  status!: AdminArticleEditorDraftValues["status"];

  @IsString()
  categorySlug!: string;

  @IsArray()
  @IsString({ each: true })
  tagSlugs!: string[];

  @IsString()
  coverImageUrl!: string;

  @IsOptional()
  @IsIn(["ORIGINAL", "REPOSTED"])
  origin!: AdminArticleEditorDraftValues["origin"];

  @IsOptional()
  @IsString()
  sourceName!: string;

  @IsOptional()
  @IsString()
  sourceAuthor!: string;

  @IsOptional()
  @IsString()
  sourceUrl!: string;
}

class SaveAdminArticleEditorDraftDto implements SaveAdminArticleEditorDraftRequest {
  @IsOptional()
  @IsString()
  articleId?: string | null;

  @IsOptional()
  @IsString()
  baseArticleUpdatedAt?: string | null;

  @IsDefined()
  @IsString()
  clientSavedAt!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => AdminArticleEditorDraftValuesDto)
  values!: AdminArticleEditorDraftValuesDto;
}

export { AdminArticleEditorDraftValuesDto, SaveAdminArticleEditorDraftDto };
