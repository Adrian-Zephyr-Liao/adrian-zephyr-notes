import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { GetAdminSiteConfigUseCase } from "./application/get-admin-site-config.use-case";
import { GetPublicSiteConfigUseCase } from "./application/get-public-site-config.use-case";
import { UpdateAdminSiteAnnouncementUseCase } from "./application/update-admin-site-announcement.use-case";
import { UpdateAdminSiteSettingsUseCase } from "./application/update-admin-site-settings.use-case";
import { SITE_CONFIG_REPOSITORY } from "./domain/site-config.repository";
import { PrismaSiteConfigRepository } from "./infrastructure/prisma-site-config.repository";
import { AdminSiteConfigController } from "./presentation/admin-site-config.controller";
import { SiteConfigController } from "./presentation/site-config.controller";

@Module({
  imports: [AuditModule, AuthModule, PrismaModule],
  controllers: [SiteConfigController, AdminSiteConfigController],
  providers: [
    GetAdminSiteConfigUseCase,
    GetPublicSiteConfigUseCase,
    UpdateAdminSiteAnnouncementUseCase,
    UpdateAdminSiteSettingsUseCase,
    {
      provide: SITE_CONFIG_REPOSITORY,
      useClass: PrismaSiteConfigRepository,
    },
  ],
  exports: [GetAdminSiteConfigUseCase, SITE_CONFIG_REPOSITORY, UpdateAdminSiteAnnouncementUseCase],
})
export class SiteConfigModule {}
