import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from "class-validator";
import type { UpdateAdminSiteSettingsRequest } from "@adrian-zephyr-notes/contracts";

type UpdateAdminSiteHomeConfigInput = UpdateAdminSiteSettingsRequest["home"];
type UpdateAdminSiteNavigationItemInput = UpdateAdminSiteSettingsRequest["navigationItems"][number];
type UpdateAdminSiteSocialLinkInput = UpdateAdminSiteSettingsRequest["socialLinks"][number];

class UpdateAdminSiteHomeConfigDto implements UpdateAdminSiteHomeConfigInput {
  @IsString()
  eyebrow!: string;

  @IsString()
  title!: string;

  @IsString()
  subtitle!: string;

  @IsString()
  primaryActionLabel!: string;

  @IsString()
  primaryActionHref!: string;

  @IsOptional()
  @IsString()
  secondaryActionLabel!: string | null;

  @IsOptional()
  @IsString()
  secondaryActionHref!: string | null;
}

class UpdateAdminSiteNavigationItemDto implements UpdateAdminSiteNavigationItemInput {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsString()
  href!: string;

  @IsBoolean()
  isExternal!: boolean;

  @IsBoolean()
  isEnabled!: boolean;

  @IsInt()
  sortOrder!: number;
}

class UpdateAdminSiteSocialLinkDto implements UpdateAdminSiteSocialLinkInput {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsString()
  href!: string;

  @IsString()
  icon!: string;

  @IsBoolean()
  isExternal!: boolean;

  @IsBoolean()
  isEnabled!: boolean;

  @IsInt()
  sortOrder!: number;
}

class UpdateAdminSiteSettingsDto implements UpdateAdminSiteSettingsRequest {
  @ValidateNested()
  @Type(() => UpdateAdminSiteHomeConfigDto)
  home!: UpdateAdminSiteHomeConfigDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminSiteNavigationItemDto)
  navigationItems!: UpdateAdminSiteNavigationItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminSiteSocialLinkDto)
  socialLinks!: UpdateAdminSiteSocialLinkDto[];
}

export { UpdateAdminSiteSettingsDto };
