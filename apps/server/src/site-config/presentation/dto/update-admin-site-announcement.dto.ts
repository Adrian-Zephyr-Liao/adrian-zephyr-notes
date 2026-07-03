import { IsBoolean, IsInt, IsOptional, IsString } from "class-validator";
import type { UpdateAdminSiteAnnouncementRequest } from "@adrian-zephyr-notes/contracts";

class UpdateAdminSiteAnnouncementDto implements UpdateAdminSiteAnnouncementRequest {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  iconClassName?: string;

  @IsOptional()
  @IsString()
  process?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  command?: string;

  @IsOptional()
  @IsString()
  output?: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export { UpdateAdminSiteAnnouncementDto };
