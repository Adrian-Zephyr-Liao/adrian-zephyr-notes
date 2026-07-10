import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminAgentModule } from "./admin-agent/admin-agent.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { ArticlesModule } from "./articles/articles.module";
import { CommentsModule } from "./comments/comments.module";
import { GuestbookModule } from "./guestbook/guestbook.module";
import { SiteConfigModule } from "./site-config/site-config.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "../../.env", "apps/server/.env"],
      isGlobal: true,
    }),
    AdminAgentModule,
    AuthModule,
    AuditModule,
    ArticlesModule,
    CommentsModule,
    GuestbookModule,
    SiteConfigModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
