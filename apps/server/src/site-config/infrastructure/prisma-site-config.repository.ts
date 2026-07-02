import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { SiteAnnouncement } from "../domain/site-announcement.entity";
import type { SiteConfigRepository } from "../domain/site-config.repository";

@Injectable()
class PrismaSiteConfigRepository implements SiteConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

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

    return records.map((record) =>
      SiteAnnouncement.create({
        id: record.id,
        key: record.key,
        title: record.title,
        icon: record.icon,
        iconClassName: record.iconClassName,
        process: record.process,
        status: record.status,
        command: record.command,
        output: record.output,
        sortOrder: record.sortOrder,
        updatedAt: record.updatedAt,
      }),
    );
  }
}

export { PrismaSiteConfigRepository };
