import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
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
import { AdminAgentTaskListQueryDto } from "./dto/admin-agent-task-list-query.dto";
import { ControlAdminAgentTaskDto } from "./dto/control-admin-agent-task.dto";
import { DecideAdminAgentFindingsDto } from "./dto/decide-admin-agent-findings.dto";
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
