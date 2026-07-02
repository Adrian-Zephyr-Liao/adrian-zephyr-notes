import { Module } from "@nestjs/common";
import { PrismaModule } from "../database/prisma.module";
import { GetPublicSiteConfigUseCase } from "./application/get-public-site-config.use-case";
import { SITE_CONFIG_REPOSITORY } from "./domain/site-config.repository";
import { PrismaSiteConfigRepository } from "./infrastructure/prisma-site-config.repository";
import { SiteConfigController } from "./presentation/site-config.controller";

@Module({
  imports: [PrismaModule],
  controllers: [SiteConfigController],
  providers: [
    GetPublicSiteConfigUseCase,
    {
      provide: SITE_CONFIG_REPOSITORY,
      useClass: PrismaSiteConfigRepository,
    },
  ],
})
export class SiteConfigModule {}
