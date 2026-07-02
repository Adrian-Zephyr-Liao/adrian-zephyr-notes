import { Controller, Get } from "@nestjs/common";
import type { SiteConfigResponse } from "@adrian-zephyr-notes/contracts";
import { GetPublicSiteConfigUseCase } from "../application/get-public-site-config.use-case";
import { toSiteConfigResponse } from "../infrastructure/site-config.mapper";

@Controller("api/site-config")
class SiteConfigController {
  constructor(private readonly getPublicSiteConfig: GetPublicSiteConfigUseCase) {}

  @Get()
  async get(): Promise<SiteConfigResponse> {
    return toSiteConfigResponse(await this.getPublicSiteConfig.execute());
  }
}

export { SiteConfigController };
