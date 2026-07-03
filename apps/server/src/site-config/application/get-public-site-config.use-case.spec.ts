import { describe, expect, it } from "vitest";
import { SiteAnnouncement } from "../domain/site-announcement.entity";
import type { SiteConfigRepository } from "../domain/site-config.repository";
import { defaultSiteConfigSettings, type SiteConfigSettings } from "../domain/site-settings";
import { GetPublicSiteConfigUseCase } from "./get-public-site-config.use-case";

describe("GetPublicSiteConfigUseCase", () => {
  it("returns enabled site announcements from the repository", async () => {
    const announcement = SiteAnnouncement.create({
      id: "notice-writing-queue",
      key: "writing-queue",
      title: "writing queue",
      icon: "sparkles-2-line",
      iconClassName: "text-primary",
      process: "notes.sync",
      status: "running",
      command: "pnpm notes:sync --scope writing",
      output: "长期有效的思考正在整理成更耐读的笔记。",
      isEnabled: true,
      sortOrder: 10,
      createdAt: new Date("2026-07-02T10:00:00.000Z"),
      updatedAt: new Date("2026-07-02T10:00:00.000Z"),
    });
    const useCase = new GetPublicSiteConfigUseCase(new StaticSiteConfigRepository([announcement]));

    await expect(useCase.execute()).resolves.toEqual({
      announcements: [announcement],
      settings: defaultSiteConfigSettings,
    });
  });
});

class StaticSiteConfigRepository implements SiteConfigRepository {
  constructor(private readonly announcements: SiteAnnouncement[]) {}

  async listEnabledAnnouncements() {
    return this.announcements;
  }

  async listAllAnnouncements() {
    return this.announcements;
  }

  async getSettings() {
    return defaultSiteConfigSettings;
  }

  async saveSettings(settings: SiteConfigSettings) {
    return settings;
  }

  async updateAnnouncement() {
    return null;
  }
}
