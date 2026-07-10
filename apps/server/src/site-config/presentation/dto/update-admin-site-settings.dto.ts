import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import type { UpdateAdminSiteSettingsRequest } from "@adrian-zephyr-notes/contracts";

type UpdateAdminAgentAutomationPolicyInput =
  UpdateAdminSiteSettingsRequest["adminAgentAutomationPolicy"];
type UpdateAdminSiteHomeConfigInput = UpdateAdminSiteSettingsRequest["home"];
type UpdateAdminSiteNavigationItemInput = UpdateAdminSiteSettingsRequest["navigationItems"][number];
type UpdateAdminSiteSocialLinkInput = UpdateAdminSiteSettingsRequest["socialLinks"][number];

class UpdateAdminAgentAutomationPolicyDto implements UpdateAdminAgentAutomationPolicyInput {
  @IsIn(["MANUAL_REVIEW"])
  mode!: "MANUAL_REVIEW";

  @IsBoolean()
  autoHideEnabled!: boolean;

  @IsArray()
  @IsIn(["SPAM", "ABUSE"], { each: true })
  eligibleCategories!: Array<"SPAM" | "ABUSE">;

  @Type(() => Number)
  @IsNumber()
  @Min(0.5)
  @Max(1)
  confidenceThreshold!: number;

  @IsBoolean()
  requiresStrongEvidence!: boolean;
}

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
  @Type(() => UpdateAdminAgentAutomationPolicyDto)
  adminAgentAutomationPolicy!: UpdateAdminAgentAutomationPolicyDto;

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
