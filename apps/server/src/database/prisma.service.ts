import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>("DATABASE_URL");

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required to start the server.");
    }

    super({
      adapter: new PrismaPg(databaseUrl),
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
