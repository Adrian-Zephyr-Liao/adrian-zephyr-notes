import { Module } from "@nestjs/common";
import { ArticlesModule } from "../articles/articles.module";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { CommentsModule } from "../comments/comments.module";
import { PrismaModule } from "../database/prisma.module";
import { SiteConfigModule } from "../site-config/site-config.module";
import { CommentModerationAgentActionHandler } from "./application/comment-moderation-agent-action.handler";
import { DecideAdminAgentFindingUseCase } from "./application/decide-admin-agent-finding.use-case";
import { DecideAdminAgentFindingsUseCase } from "./application/decide-admin-agent-findings.use-case";
import { RegisteredAdminAgentWorkflowRegistry } from "./application/admin-agent-workflow-registry";
import { ExecuteAdminAgentWorkflowActionUseCase } from "./application/execute-admin-agent-workflow-action.use-case";
import { GetAdminAgentHomeUseCase } from "./application/get-admin-agent-home.use-case";
import { ListAdminAgentConversationMessagesUseCase } from "./application/list-admin-agent-conversation-messages.use-case";
import { ManageAdminAgentWorkflowsUseCase } from "./application/manage-admin-agent-workflows.use-case";
import { RepairAdminAgentDecisionEffectsUseCase } from "./application/repair-admin-agent-decision-effects.use-case";
import { SendAdminAgentChatMessageUseCase } from "./application/send-admin-agent-chat-message.use-case";
import { SiteConfigAgentActionHandler } from "./application/site-config-agent-action.handler";
import { ADMIN_AGENT_AUTOMATION_POLICY_REPOSITORY } from "./domain/admin-agent-automation-policy.repository";
import { ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY } from "./domain/admin-agent-chat-message.repository";
import { ADMIN_AGENT_CHAT_RUNNER } from "./domain/admin-agent-chat-runner";
import { ADMIN_AGENT_HOME_REPOSITORY } from "./domain/admin-agent-home.repository";
import { ADMIN_AGENT_REPOSITORY } from "./domain/admin-agent.repository";
import {
  ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR,
  ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS,
} from "./domain/admin-agent-workflow-action-executor";
import { ADMIN_AGENT_WORKFLOW_REGISTRY } from "./domain/admin-agent-workflow-definition";
import { ADMIN_AGENT_WORKFLOW_RUNNER } from "./domain/admin-agent-workflow-runner";
import { OpenAiCompatibleAdminAgentChatRunner } from "./infrastructure/ai/openai-compatible-admin-agent-chat.runner";
import { OpenAiCompatibleChatCompletionClient } from "./infrastructure/ai/openai-compatible-chat-completion.client";
import { LangGraphAdminAgentWorkflowRunner } from "./infrastructure/langgraph-admin-agent-workflow.runner";
import { PrismaAdminAgentAutomationPolicyRepository } from "./infrastructure/prisma-admin-agent-automation-policy.repository";
import { PrismaAdminAgentChatMessageRepository } from "./infrastructure/prisma-admin-agent-chat-message.repository";
import { PrismaAdminAgentRepository } from "./infrastructure/prisma-admin-agent.repository";
import { PrismaAdminAgentHomeRepository } from "./infrastructure/prisma-admin-agent-home.repository";
import { AdminAgentCopilotKitController } from "./presentation/admin-agent-copilotkit.controller";
import { AdminAgentController } from "./presentation/admin-agent.controller";

@Module({
  imports: [
    ArticlesModule,
    AuditModule,
    AuthModule,
    CommentsModule,
    PrismaModule,
    SiteConfigModule,
  ],
  controllers: [AdminAgentController, AdminAgentCopilotKitController],
  providers: [
    DecideAdminAgentFindingUseCase,
    DecideAdminAgentFindingsUseCase,
    CommentModerationAgentActionHandler,
    ExecuteAdminAgentWorkflowActionUseCase,
    GetAdminAgentHomeUseCase,
    ListAdminAgentConversationMessagesUseCase,
    ManageAdminAgentWorkflowsUseCase,
    RepairAdminAgentDecisionEffectsUseCase,
    SendAdminAgentChatMessageUseCase,
    SiteConfigAgentActionHandler,
    OpenAiCompatibleChatCompletionClient,
    {
      provide: ADMIN_AGENT_CHAT_RUNNER,
      useClass: OpenAiCompatibleAdminAgentChatRunner,
    },
    {
      provide: ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY,
      useClass: PrismaAdminAgentChatMessageRepository,
    },
    {
      provide: ADMIN_AGENT_WORKFLOW_RUNNER,
      useClass: LangGraphAdminAgentWorkflowRunner,
    },
    {
      provide: ADMIN_AGENT_WORKFLOW_REGISTRY,
      useClass: RegisteredAdminAgentWorkflowRegistry,
    },
    {
      provide: ADMIN_AGENT_WORKFLOW_ACTION_EXECUTOR,
      useClass: ExecuteAdminAgentWorkflowActionUseCase,
    },
    {
      provide: ADMIN_AGENT_WORKFLOW_ACTION_HANDLERS,
      useFactory: (
        commentModeration: CommentModerationAgentActionHandler,
        siteConfig: SiteConfigAgentActionHandler,
      ) => [commentModeration, siteConfig],
      inject: [CommentModerationAgentActionHandler, SiteConfigAgentActionHandler],
    },
    {
      provide: ADMIN_AGENT_AUTOMATION_POLICY_REPOSITORY,
      useClass: PrismaAdminAgentAutomationPolicyRepository,
    },
    {
      provide: ADMIN_AGENT_HOME_REPOSITORY,
      useClass: PrismaAdminAgentHomeRepository,
    },
    {
      provide: ADMIN_AGENT_REPOSITORY,
      useClass: PrismaAdminAgentRepository,
    },
  ],
})
export class AdminAgentModule {}
