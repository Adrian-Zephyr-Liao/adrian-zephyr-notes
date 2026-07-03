import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { SiteAnnouncement } from "../domain/site-announcement.entity";
import type {
  SiteConfigRepository,
  UpdateSiteAnnouncementInput,
} from "../domain/site-config.repository";
import {
  defaultSiteConfigSettings,
  normalizeSiteConfigSettings,
  type SiteConfigSettings,
} from "../domain/site-settings";

const SITE_SETTING_KEYS = {
  home: "home",
  navigationItems: "navigation-items",
  socialLinks: "social-links",
} as const;

@Injectable()
class PrismaSiteConfigRepository implements SiteConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings() {
    const records = await this.prisma.siteSetting.findMany({
      where: {
        key: {
          in: Object.values(SITE_SETTING_KEYS),
        },
      },
    });
    const settingsByKey = new Map(records.map((record) => [record.key, record.value]));

    return normalizeSiteConfigSettings({
      home: toSettingValue(
        settingsByKey.get(SITE_SETTING_KEYS.home),
        defaultSiteConfigSettings.home,
      ),
      navigationItems: toSettingValue(
        settingsByKey.get(SITE_SETTING_KEYS.navigationItems),
        defaultSiteConfigSettings.navigationItems,
      ),
      socialLinks: toSettingValue(
        settingsByKey.get(SITE_SETTING_KEYS.socialLinks),
        defaultSiteConfigSettings.socialLinks,
      ),
    });
  }

  async listAllAnnouncements() {
    const records = await this.prisma.siteAnnouncement.findMany({
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    return records.map(toDomainSiteAnnouncement);
  }

  async listEnabledAnnouncements() {
    const records = await this.prisma.siteAnnouncement.findMany({
      where: {
        isEnabled: true,
      },
      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    return records.map(toDomainSiteAnnouncement);
  }

  async saveSettings(settings: SiteConfigSettings) {
    const normalizedSettings = normalizeSiteConfigSettings(settings);

    await this.prisma.$transaction([
      this.prisma.siteSetting.upsert({
        where: { key: SITE_SETTING_KEYS.home },
        update: { value: normalizedSettings.home },
        create: { key: SITE_SETTING_KEYS.home, value: normalizedSettings.home },
      }),
      this.prisma.siteSetting.upsert({
        where: { key: SITE_SETTING_KEYS.navigationItems },
        update: { value: normalizedSettings.navigationItems },
        create: {
          key: SITE_SETTING_KEYS.navigationItems,
          value: normalizedSettings.navigationItems,
        },
      }),
      this.prisma.siteSetting.upsert({
        where: { key: SITE_SETTING_KEYS.socialLinks },
        update: { value: normalizedSettings.socialLinks },
        create: { key: SITE_SETTING_KEYS.socialLinks, value: normalizedSettings.socialLinks },
      }),
    ]);

    return normalizedSettings;
  }

  async updateAnnouncement(input: UpdateSiteAnnouncementInput) {
    try {
      const record = await this.prisma.siteAnnouncement.update({
        where: {
          id: input.id,
        },
        data: toSiteAnnouncementUpdateData(input),
      });

      return toDomainSiteAnnouncement(record);
    } catch (error) {
      if (isPrismaRecordNotFound(error)) {
        return null;
      }

      throw error;
    }
  }
}

function toDomainSiteAnnouncement(record: {
  command: string;
  createdAt: Date;
  icon: string;
  iconClassName: string;
  id: string;
  isEnabled: boolean;
  key: string;
  output: string;
  process: string;
  sortOrder: number;
  status: string;
  title: string;
  updatedAt: Date;
}) {
  return SiteAnnouncement.create({
    id: record.id,
    key: record.key,
    title: record.title,
    icon: record.icon,
    iconClassName: record.iconClassName,
    process: record.process,
    status: record.status,
    command: record.command,
    output: record.output,
    isEnabled: record.isEnabled,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

function toSiteAnnouncementUpdateData(
  input: UpdateSiteAnnouncementInput,
): Prisma.SiteAnnouncementUpdateInput {
  const data: Prisma.SiteAnnouncementUpdateInput = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.iconClassName !== undefined) data.iconClassName = input.iconClassName;
  if (input.process !== undefined) data.process = input.process;
  if (input.status !== undefined) data.status = input.status;
  if (input.command !== undefined) data.command = input.command;
  if (input.output !== undefined) data.output = input.output;
  if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

  return data;
}

function toSettingValue<TValue>(value: Prisma.JsonValue | undefined, fallback: TValue): TValue {
  return value === undefined || value === null ? fallback : (value as TValue);
}

function isPrismaRecordNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export { PrismaSiteConfigRepository };
