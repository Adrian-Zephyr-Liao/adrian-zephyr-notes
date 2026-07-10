import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type {
  AdminSiteAnnouncementResponse,
  AdminSiteConfigResponse,
} from "@adrian-zephyr-notes/contracts";
import { RecordAdminOperationUseCase } from "../../audit/application/record-admin-operation.use-case";
import {
  toAdminOperationActor,
  toAdminOperationRequestContext,
} from "../../audit/presentation/admin-audit-context";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import {
  AdminSiteAnnouncementNotFoundError,
  AdminSiteConfigValidationError,
} from "../application/admin-site-config.errors";
import { GetAdminSiteConfigUseCase } from "../application/get-admin-site-config.use-case";
import { UpdateAdminSiteAnnouncementUseCase } from "../application/update-admin-site-announcement.use-case";
import { UpdateAdminSiteSettingsUseCase } from "../application/update-admin-site-settings.use-case";
import {
  toAdminSiteAnnouncementResponse,
  toAdminSiteConfigResponse,
} from "../infrastructure/site-config.mapper";
import { UpdateAdminSiteAnnouncementDto } from "./dto/update-admin-site-announcement.dto";
import { UpdateAdminSiteSettingsDto } from "./dto/update-admin-site-settings.dto";

@Controller("api/admin/site-config")
@UseGuards(AdminAuthGuard)
class AdminSiteConfigController {
  constructor(
    private readonly getAdminSiteConfig: GetAdminSiteConfigUseCase,
    private readonly recordAdminOperation: RecordAdminOperationUseCase,
    private readonly updateAdminSiteAnnouncement: UpdateAdminSiteAnnouncementUseCase,
    private readonly updateAdminSiteSettings: UpdateAdminSiteSettingsUseCase,
  ) {}

  @Get()
  async get(): Promise<AdminSiteConfigResponse> {
    return toAdminSiteConfigResponse(await this.getAdminSiteConfig.execute());
  }

  @Patch("announcements/:id")
  async updateAnnouncement(
    @Param("id") id: string,
    @Body() body: UpdateAdminSiteAnnouncementDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminSiteAnnouncementResponse> {
    try {
      const announcement = await this.updateAdminSiteAnnouncement.execute({
        id,
        command: body.command,
        icon: body.icon,
        iconClassName: body.iconClassName,
        isEnabled: body.isEnabled,
        output: body.output,
        process: body.process,
        sortOrder: body.sortOrder,
        status: body.status,
        title: body.title,
      });

      await this.recordAdminOperation.execute({
        actor: toAdminOperationActor(admin),
        action: "SITE_ANNOUNCEMENT_UPDATED",
        resourceType: "site_announcement",
        resourceId: announcement.id,
        metadata: {
          isEnabled: announcement.isEnabled,
          key: announcement.key,
          sortOrder: announcement.sortOrder,
        },
        requestContext: toAdminOperationRequestContext(request),
      });

      return toAdminSiteAnnouncementResponse(announcement);
    } catch (error) {
      throw mapAdminSiteConfigError(error);
    }
  }

  @Put("settings")
  async updateSettings(
    @Body() body: UpdateAdminSiteSettingsDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<AdminSiteConfigResponse> {
    try {
      await this.updateAdminSiteSettings.execute({
        adminAgentAutomationPolicy: body.adminAgentAutomationPolicy,
        home: body.home,
        navigationItems: body.navigationItems,
        socialLinks: body.socialLinks,
      });

      await this.recordAdminOperation.execute({
        actor: toAdminOperationActor(admin),
        action: "SITE_SETTINGS_UPDATED",
        resourceType: "site_settings",
        resourceId: null,
        metadata: {
          adminAgentAutomationPolicyMode: body.adminAgentAutomationPolicy.mode,
          navigationItemCount: body.navigationItems.length,
          socialLinkCount: body.socialLinks.length,
        },
        requestContext: toAdminOperationRequestContext(request),
      });

      return toAdminSiteConfigResponse(await this.getAdminSiteConfig.execute());
    } catch (error) {
      throw mapAdminSiteConfigError(error);
    }
  }
}

function mapAdminSiteConfigError(error: unknown) {
  if (error instanceof AdminSiteAnnouncementNotFoundError) {
    return new NotFoundException({
      error: {
        code: "ADMIN_SITE_ANNOUNCEMENT_NOT_FOUND",
        message: "Site announcement not found",
      },
    });
  }

  if (error instanceof AdminSiteConfigValidationError) {
    return new BadRequestException({
      error: {
        code: "ADMIN_SITE_CONFIG_VALIDATION_FAILED",
        message: error.message,
      },
    });
  }

  return error;
}

export { AdminSiteConfigController };
