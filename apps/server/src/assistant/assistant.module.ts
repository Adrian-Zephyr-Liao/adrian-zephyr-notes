import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OAuthModule } from "../oauth/oauth.module";
import { AuditModule } from "../audit/audit.module";
import { CommentsModule } from "../comments/comments.module";
import { PrismaModule } from "../database/prisma.module";
import { AssistantService } from "./application/assistant.service";
import { AssistantActionService } from "./application/assistant-action.service";
import { ASSISTANT_REPOSITORY } from "./domain/assistant.repository";
import { ASSISTANT_RUNNER } from "./application/assistant-runner.port";
import { PrismaAssistantRepository } from "./infrastructure/prisma-assistant.repository";
import { AssistantToolsRegistry } from "./infrastructure/assistant-tools.registry";
import { PiAssistantModelClient } from "./infrastructure/pi-assistant-model.client";
import { PiAssistantRunner } from "./infrastructure/pi-assistant.runner";
import { AssistantController } from "./presentation/assistant.controller";

@Module({
  imports: [AuthModule, OAuthModule, AuditModule, CommentsModule, PrismaModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    AssistantActionService,
    AssistantToolsRegistry,
    PiAssistantModelClient,
    { provide: ASSISTANT_REPOSITORY, useClass: PrismaAssistantRepository },
    { provide: ASSISTANT_RUNNER, useClass: PiAssistantRunner },
  ],
})
export class AssistantModule {}
