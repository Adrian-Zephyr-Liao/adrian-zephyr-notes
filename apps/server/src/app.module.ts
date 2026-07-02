import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { ArticlesModule } from "./articles/articles.module";
import { CommentsModule } from "./comments/comments.module";
import { GuestbookModule } from "./guestbook/guestbook.module";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [".env", "apps/server/.env"],
      isGlobal: true,
    }),
    AuthModule,
    ArticlesModule,
    CommentsModule,
    GuestbookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
