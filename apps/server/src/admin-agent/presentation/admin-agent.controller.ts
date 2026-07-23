import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import type {
  AdminAgentHomeResponse,
  AdminAgentConversationMessagesResponse,
  AdminAgentTaskSummaryResponse,
  AdminAgentTaskListResponse,
  ControlAdminAgentTaskResponse,
  DecideAdminAgentFindingsResponse,
  ModerateAdminAgentCommentAnalysisResponse,
  ResumeAdminAgentTaskResponse,
  StartAdminAgentTaskResponse,
} from "@adrian-zephyr-notes/contracts";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import {
  toAdminOperationActor,
  toAdminOperationRequestContext,
} from "../../audit/presentation/admin-audit-context";
import { DecideAdminAgentFindingsUseCase } from "../application/decide-admin-agent-findings.use-case";
import { GetAdminAgentHomeUseCase } from "../application/get-admin-agent-home.use-case";
import { ListAdminAgentConversationMessagesUseCase } from "../application/list-admin-agent-conversation-messages.use-case";
import {
  AdminAgentCommentAnalysisNotFoundError,
  AdminAgentCommentAnalysisSelectionError,
  ModerateAdminAgentCommentAnalysisUseCase,
} from "../application/moderate-admin-agent-comment-analysis.use-case";
import {
  ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY,
  type AdminAgentChatMessageRepository,
} from "../domain/admin-agent-chat-message.repository";
import {
  AdminAgentWorkflowActiveRunRetryError,
  AdminAgentWorkflowCancelUnavailableError,
  AdminAgentWorkflowNotFoundError,
  AdminAgentWorkflowBranchUnavailableError,
  AdminAgentWorkflowRefreshUnavailableError,
  AdminAgentWorkflowResumeUnavailableError,
  AdminAgentWorkflowResumeUnsupportedError,
  AdminAgentWorkflowStartUnsupportedError,
  AdminAgentWorkflowUnsupportedControlActionError,
  AdminAgentWorkflowUnsupportedError,
  ManageAdminAgentWorkflowsUseCase,
} from "../application/manage-admin-agent-workflows.use-case";
import {
  AdminAgentWorkflowExecutionError,
  AdminAgentWorkflowInvalidResumeError,
} from "../domain/admin-agent-workflow-runner";
import {
  toAdminAgentFindingResponse,
  toAdminAgentConversationMessagesResponse,
  toAdminAgentHomeResponse,
  toAdminAgentTaskSummaryResponse,
  toAdminAgentTaskResponse,
  toAdminAgentTaskListResponse,
} from "../infrastructure/admin-agent-home.mapper";
import { toAdminAgentWorkflowNameFromTaskName } from "../domain/admin-agent-workflow-metadata";
import { createCommentAnalysisActivityMessage } from "../infrastructure/admin-agent-comment-analysis-a2ui";
import { AdminAgentTaskListQueryDto } from "./dto/admin-agent-task-list-query.dto";
import { ControlAdminAgentTaskDto } from "./dto/control-admin-agent-task.dto";
import { DecideAdminAgentFindingsDto } from "./dto/decide-admin-agent-findings.dto";
import { ModerateAdminAgentCommentAnalysisDto } from "./dto/moderate-admin-agent-comment-analysis.dto";
import { ResumeAdminAgentTaskDto } from "./dto/resume-admin-agent-task.dto";
import { StartAdminAgentTaskDto } from "./dto/start-admin-agent-task.dto";

@Controller("api/admin/agent")
@UseGuards(AdminAuthGuard)
class AdminAgentController {
  constructor(
    private readonly decideAdminAgentFindings: DecideAdminAgentFindingsUseCase,
    private readonly getAdminAgentHome: GetAdminAgentHomeUseCase,
    private readonly listAdminAgentConversationMessages: ListAdminAgentConversationMessagesUseCase,
    private readonly manageAdminAgentWorkflows: ManageAdminAgentWorkflowsUseCase,
    private readonly moderateCommentAnalysis: ModerateAdminAgentCommentAnalysisUseCase,
    @Inject(ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY)
    private readonly chatMessageRepository: AdminAgentChatMessageRepository,
  ) {}

  @Get("home")
  async home(): Promise<AdminAgentHomeResponse> {
    return toAdminAgentHomeResponse(await this.getAdminAgentHome.execute());
  }

  @Post("findings/decisions")
  async decideFindings(
    @Body() body: DecideAdminAgentFindingsDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<DecideAdminAgentFindingsResponse> {
    const result = await this.decideAdminAgentFindings.execute({
      actor: toAdminOperationActor(admin),
      decisions: body.decisions,
      requestContext: toAdminOperationRequestContext(request),
    });

    return {
      results: result.results.map((item) => {
        if (item.status === "FAILED") {
          return {
            decision: item.decision,
            error: item.error,
            findingId: item.findingId,
            status: item.status,
          };
        }

        return {
          decision: item.decision,
          finding: toAdminAgentFindingResponse(item.result.finding),
          findingId: item.findingId,
          status: item.status,
        };
      }),
    };
  }

  @Get("tasks")
  async listTasks(@Query() query: AdminAgentTaskListQueryDto): Promise<AdminAgentTaskListResponse> {
    return toAdminAgentTaskListResponse(
      await this.manageAdminAgentWorkflows.listRuns({
        page: query.page,
        pageSize: query.pageSize,
        parentRunId: query.parentTaskId,
        parentRunRelation: toAdminAgentParentRunRelationFromQuery(query.relation),
        rootOnly: query.rootOnly,
        status: query.status === "ALL" ? undefined : query.status,
        workflowName:
          !query.taskName || query.taskName === "ALL"
            ? undefined
            : toAdminAgentWorkflowNameFromTaskName(query.taskName),
      }),
    );
  }

  @Get("conversations/:conversationId/messages")
  async listConversationMessages(
    @Param("conversationId") conversationId: string,
  ): Promise<AdminAgentConversationMessagesResponse> {
    return toAdminAgentConversationMessagesResponse(
      await this.listAdminAgentConversationMessages.execute({
        conversationId,
      }),
    );
  }

  @Post("conversations/:conversationId/comment-analyses/:analysisId/hide")
  async hideCommentAnalysisFindings(
    @Param("conversationId") conversationIdValue: string,
    @Param("analysisId") analysisId: string,
    @Body() body: ModerateAdminAgentCommentAnalysisDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<ModerateAdminAgentCommentAnalysisResponse> {
    const conversationId = conversationIdValue.trim().slice(0, 200);

    if (!conversationId) {
      throw new BadRequestException("Conversation ID is required.");
    }

    try {
      const moderation = await this.moderateCommentAnalysis.execute({
        action: "HIDE",
        actor: toAdminOperationActor(admin),
        analysisId,
        findingIds: body.findingIds,
        requestContext: toAdminOperationRequestContext(request),
      });
      const activityMessage = createCommentAnalysisActivityMessage({
        analysisId: moderation.analysis.id,
        analyzedCount: toNonnegativeInteger(
          moderation.analysis.output?.analyzedCount,
          moderation.findings.length,
        ),
        findings: moderation.findings,
        scope: moderation.analysis.output?.scope,
        summary: moderation.analysis.summary ?? "评论风险分析已更新。",
      });

      await this.chatMessageRepository.recordMessage({
        conversationId,
        message: activityMessage,
      });

      const appliedCount = moderation.result.results.filter(
        (item) => item.status === "APPLIED",
      ).length;

      return {
        activityMessage,
        analysisId: moderation.analysis.id,
        appliedCount,
        failedCount: moderation.result.results.length - appliedCount,
        results: moderation.result.results.map((item) =>
          item.status === "FAILED"
            ? {
                error: item.error,
                findingId: item.findingId,
                status: item.status,
              }
            : {
                findingId: item.findingId,
                status: item.status,
              },
        ),
      };
    } catch (error) {
      if (error instanceof AdminAgentCommentAnalysisNotFoundError) {
        throw new NotFoundException(error.message);
      }

      if (error instanceof AdminAgentCommentAnalysisSelectionError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }

  @Get("tasks/:taskId")
  async getTask(@Param("taskId") taskId: string): Promise<AdminAgentTaskSummaryResponse> {
    try {
      return toAdminAgentTaskSummaryResponse(await this.manageAdminAgentWorkflows.getRun(taskId));
    } catch (error) {
      throw toAdminAgentWorkflowHttpException(error);
    }
  }

  @Post("tasks")
  async startTask(
    @Body() body: StartAdminAgentTaskDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<StartAdminAgentTaskResponse> {
    try {
      return toAdminAgentTaskResponse(
        await this.manageAdminAgentWorkflows.startWorkflow({
          actor: toAdminOperationActor(admin),
          input: body.input ?? null,
          requestContext: toAdminOperationRequestContext(request),
          startedByUserId: admin.id,
          workflowName: toAdminAgentWorkflowNameFromTaskName(body.taskName),
        }),
      );
    } catch (error) {
      throw toAdminAgentWorkflowHttpException(error);
    }
  }

  @Post("tasks/:taskId/control")
  async controlTask(
    @Param("taskId") taskId: string,
    @Body() body: ControlAdminAgentTaskDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<ControlAdminAgentTaskResponse> {
    try {
      return toAdminAgentTaskResponse(
        await this.manageAdminAgentWorkflows.controlRun({
          action: body.action,
          actor: toAdminOperationActor(admin),
          requestContext: toAdminOperationRequestContext(request),
          runId: taskId,
          startedByUserId: admin.id,
        }),
      );
    } catch (error) {
      throw toAdminAgentWorkflowHttpException(error);
    }
  }

  @Post("tasks/:taskId/resume")
  async resumeTask(
    @Param("taskId") taskId: string,
    @Body() body: ResumeAdminAgentTaskDto,
    @CurrentAdmin() admin: AuthUser,
    @Req() request: Request,
  ): Promise<ResumeAdminAgentTaskResponse> {
    try {
      return toAdminAgentTaskResponse(
        await this.manageAdminAgentWorkflows.resumeRun({
          actor: toAdminOperationActor(admin),
          requestContext: toAdminOperationRequestContext(request),
          resume: body.resume,
          runId: taskId,
        }),
      );
    } catch (error) {
      throw toAdminAgentWorkflowHttpException(error);
    }
  }
}

export { AdminAgentController };

function toNonnegativeInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function toAdminAgentParentRunRelationFromQuery(relation: AdminAgentTaskListQueryDto["relation"]) {
  if (relation === "child") {
    return "CHILD_TASK";
  }

  if (relation === "branch") {
    return "BRANCH";
  }

  if (relation === "retry") {
    return "RETRY";
  }

  return undefined;
}

function toAdminAgentWorkflowHttpException(error: unknown) {
  if (error instanceof AdminAgentWorkflowNotFoundError) {
    return new NotFoundException({
      code: "ADMIN_AGENT_WORKFLOW_NOT_FOUND",
      details: {
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowActiveRunRetryError) {
    return new ConflictException({
      code: "ADMIN_AGENT_TASK_ACTIVE_RETRY_DENIED",
      details: {
        status: error.status,
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowBranchUnavailableError) {
    return new ConflictException({
      code: "ADMIN_AGENT_TASK_BRANCH_UNAVAILABLE",
      details: {
        status: error.status,
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowRefreshUnavailableError) {
    return new ConflictException({
      code: "ADMIN_AGENT_TASK_REFRESH_UNAVAILABLE",
      details: {
        status: error.status,
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowCancelUnavailableError) {
    return new ConflictException({
      code: "ADMIN_AGENT_TASK_CANCEL_UNAVAILABLE",
      details: {
        status: error.status,
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowResumeUnavailableError) {
    return new ConflictException({
      code: "ADMIN_AGENT_TASK_RESUME_UNAVAILABLE",
      details: {
        status: error.status,
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowStartUnsupportedError) {
    return new BadRequestException({
      code: "ADMIN_AGENT_TASK_START_UNSUPPORTED",
      details: {
        taskId: error.runId,
      },
      message: "Agent task cannot be started.",
    });
  }

  if (error instanceof AdminAgentWorkflowResumeUnsupportedError) {
    return new BadRequestException({
      code: "ADMIN_AGENT_TASK_RESUME_UNSUPPORTED",
      details: {
        taskId: error.runId,
      },
      message: "Agent task does not support human approval resume.",
    });
  }

  if (error instanceof AdminAgentWorkflowUnsupportedError) {
    return new BadRequestException({
      code: "ADMIN_AGENT_TASK_UNSUPPORTED",
      details: {
        taskId: error.runId,
      },
      message: "Agent task is not supported.",
    });
  }

  if (error instanceof AdminAgentWorkflowUnsupportedControlActionError) {
    return new BadRequestException({
      code: "ADMIN_AGENT_TASK_CONTROL_ACTION_UNSUPPORTED",
      details: {
        action: error.action,
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowExecutionError) {
    return new ConflictException({
      code: "ADMIN_AGENT_TASK_EXECUTION_FAILED",
      details: {
        taskId: error.runId,
      },
      message: error.message,
    });
  }

  if (error instanceof AdminAgentWorkflowInvalidResumeError) {
    return new BadRequestException({
      code: "ADMIN_AGENT_TASK_INVALID_RESUME",
      details: {},
      message: error.message,
    });
  }

  return error;
}
