import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { EventType, PROTOCOL_VERSION } from "@ag-ui/core";
import { EventEncoder } from "@ag-ui/encoder";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import { GetCurrentAdminUseCase } from "../../auth/application/get-current-admin.use-case";
import { getSessionTokenFromRequest } from "../../auth/presentation/request-session";
import {
  AdminApiAccess,
  AdminApiAccessGuard,
} from "../../oauth/presentation/admin-api-access.guard";
import { OAuthService } from "../../oauth/application/oauth.service";
import { bearerToken } from "../../oauth/presentation/oauth-http";
import { toAdminOperationRequestContext } from "../../audit/presentation/admin-audit-context";
import { AssistantRepositoryError } from "../domain/assistant.repository";
import { mapAssistantEvents } from "./assistant-event.mapper";
import { AssistantService, AssistantRequestError } from "../application/assistant.service";
import { AssistantActionService } from "../application/assistant-action.service";

@Controller("api/admin/assistant")
@UseGuards(AdminApiAccessGuard)
export class AssistantController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly actions: AssistantActionService,
    private readonly currentAdmin: GetCurrentAdminUseCase,
    private readonly oauth: OAuthService,
  ) {}

  @Get("capabilities")
  @AdminApiAccess("admin:read")
  capabilities(@CurrentAdmin() actor: AuthUser) {
    return this.assistant.capabilities(actor);
  }

  @Post("conversations")
  @AdminApiAccess("admin:write")
  async create(@CurrentAdmin() actor: AuthUser) {
    try {
      return await this.assistant.createConversation(actor);
    } catch (error) {
      throw mapError(error);
    }
  }

  @Get("conversations/:conversationId")
  @AdminApiAccess("admin:read")
  async history(
    @CurrentAdmin() actor: AuthUser,
    @Param("conversationId") conversationId: string,
    @Query("limit") rawLimit?: string,
    @Query("before") before?: string,
  ) {
    const limit = rawLimit === undefined ? undefined : Number(rawLimit);
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 100))
      throw invalid();
    if (before !== undefined && !uuid(before)) throw invalid();
    try {
      return await this.assistant.history(actor, identifier(conversationId), { limit, before });
    } catch (error) {
      throw mapError(error);
    }
  }

  @Get("conversations/:conversationId/turns/:requestId")
  @AdminApiAccess("admin:read")
  async turn(
    @CurrentAdmin() actor: AuthUser,
    @Param("conversationId") conversationId: string,
    @Param("requestId") requestId: string,
  ) {
    try {
      return await this.assistant.getTurn(
        actor,
        identifier(conversationId),
        requestIdentifier(requestId),
      );
    } catch (error) {
      throw mapError(error);
    }
  }

  @Post("conversations/:conversationId/turns/:requestId/stop")
  @AdminApiAccess("admin:write")
  @HttpCode(200)
  async stop(
    @CurrentAdmin() actor: AuthUser,
    @Param("conversationId") conversationId: string,
    @Param("requestId") requestId: string,
  ) {
    try {
      return await this.assistant.stop(
        actor,
        identifier(conversationId),
        requestIdentifier(requestId),
      );
    } catch (error) {
      throw mapError(error);
    }
  }

  @Post("conversations/:conversationId/actions/:actionId/decision")
  @AdminApiAccess("admin:write")
  @HttpCode(200)
  async decide(
    @CurrentAdmin() actor: AuthUser,
    @Param("conversationId") conversationId: string,
    @Param("actionId") actionId: string,
    @Body() body: unknown,
    @Req() request: Request,
  ) {
    if (
      !record(body) ||
      Object.keys(body).length !== 1 ||
      (body.decision !== "CONFIRM" && body.decision !== "REJECT")
    )
      throw invalid();
    try {
      if (body.decision === "CONFIRM") this.assistant.assertEnabled();
      if (body.decision === "CONFIRM" && !this.assistant.actionsEnabled)
        throw new HttpException(
          { error: { code: "ACTION_UNAVAILABLE", message: "该操作当前未开放。" } },
          503,
        );
      return await this.actions.decide({
        actor,
        conversationId: identifier(conversationId),
        actionId: identifier(actionId),
        decision: body.decision,
        requestContext: toAdminOperationRequestContext(request),
      });
    } catch (error) {
      throw mapError(error);
    }
  }

  @Post("conversations/:conversationId/run")
  @AdminApiAccess({ allOf: ["admin:read", "admin:write"] })
  async run(
    @CurrentAdmin() actor: AuthUser,
    @Param("conversationId") conversationId: string,
    @Body() body: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const input = parseRunInput(body, identifier(conversationId));
    const disconnected = new AbortController();
    const detach = () => {
      if (!response.writableFinished) disconnected.abort();
    };
    response.once("close", detach);
    request.once("aborted", detach);
    if (request.aborted || response.destroyed) disconnected.abort();
    try {
      const accessToken =
        request.headers.authorization !== undefined ? bearerToken(request) : undefined;
      const sessionToken = accessToken ? undefined : getSessionTokenFromRequest(request);
      const events = await this.assistant.start({
        actor,
        conversationId,
        ...input,
        signal: disconnected.signal,
        authorize: async () => {
          let admin: AuthUser | null;
          try {
            if (accessToken) {
              const token = await this.oauth.authenticate(accessToken);
              if (
                !["admin:read", "admin:write"].every((scope) =>
                  token.scope.split(" ").includes(scope),
                )
              ) {
                throw new Error("Authorization scopes were revoked");
              }
              admin = token.user;
            } else {
              admin = await this.currentAdmin.execute(sessionToken);
            }
          } catch {
            throw new AssistantRequestError("ADMIN_AUTH_REQUIRED", 401, "登录已失效，请重新登录。");
          }
          if (!admin || admin.id !== actor.id)
            throw new AssistantRequestError("ADMIN_AUTH_REQUIRED", 401, "登录已失效，请重新登录。");
        },
      });
      if (!response.destroyed) {
        response.status(200).set({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        });
        response.flushHeaders();
      }
      const encoder = new EventEncoder();
      // Drain after disconnect so cancellation and its database receipt finish before cleanup.
      for await (const event of mapAssistantEvents(events)) {
        if (!response.destroyed) {
          const accepted = response.write(encoder.encode(event));
          if (!accepted) await waitForDrain(response);
        }
      }
      if (!response.destroyed) response.end();
    } catch (error) {
      if (response.destroyed) return;
      if (!response.headersSent) throw mapError(error);
      response.write(
        new EventEncoder().encode({
          type: EventType.RUN_ERROR,
          code: "ASSISTANT_EXECUTION_FAILED",
          message: "本次请求未完成，请查看已保存的记录。",
        }),
      );
      response.end();
    } finally {
      response.off("close", detach);
      request.off("aborted", detach);
    }
  }
}

export function parseRunInput(body: unknown, conversationId: string) {
  if (
    !record(body) ||
    body.threadId !== conversationId ||
    typeof body.runId !== "string" ||
    !Array.isArray(body.messages) ||
    body.messages.length > 100
  )
    throw invalid();
  const keys = new Set([
    "protocolVersion",
    "threadId",
    "runId",
    "messages",
    "state",
    "tools",
    "context",
    "forwardedProps",
  ]);
  if (Object.keys(body).some((key) => !keys.has(key))) throw invalid();
  if (body.protocolVersion !== undefined && body.protocolVersion !== PROTOCOL_VERSION)
    throw invalid();
  for (const key of ["tools", "context"])
    if (body[key] !== undefined && (!Array.isArray(body[key]) || body[key].length)) throw invalid();
  for (const key of ["state", "forwardedProps"])
    if (body[key] !== undefined && (!record(body[key]) || Object.keys(body[key]).length))
      throw invalid();
  const user = body.messages.findLast(
    (message: unknown) => record(message) && message.role === "user",
  );
  if (
    !record(user) ||
    typeof user.content !== "string" ||
    !user.content.trim() ||
    user.content.length > 2000
  )
    throw invalid();
  return { requestId: requestIdentifier(body.runId), message: user.content.trim() };
}

function requestIdentifier(value: string) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(value)) throw invalid();
  return value;
}
function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
function identifier(value: string) {
  if (!uuid(value)) throw invalid();
  return value;
}
function record(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function invalid() {
  return new BadRequestException({
    error: { code: "ASSISTANT_INPUT_INVALID", message: "请求内容无效，请刷新页面后重试。" },
  });
}
function mapError(error: unknown) {
  if (error instanceof HttpException) return error;
  if (error instanceof AssistantRequestError)
    return new HttpException({ error: { code: error.code, message: error.message } }, error.status);
  if (error instanceof AssistantRepositoryError)
    return new HttpException(
      {
        error: {
          code: error.code,
          message:
            error.code === "NOT_FOUND"
              ? "记录不存在。"
              : error.code === "RESOURCE_CHANGED"
                ? "内容已发生变化，请重新生成预览。"
                : "请求状态发生变化，请刷新后重试。",
        },
      },
      error.code === "NOT_FOUND" ? 404 : 409,
    );
  return new HttpException(
    { error: { code: "ASSISTANT_UNAVAILABLE", message: "助手暂时无法处理该请求。" } },
    503,
  );
}

async function waitForDrain(response: Response) {
  if (response.destroyed || response.writableFinished) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      response.off("drain", done);
      response.off("close", done);
      response.off("error", done);
      resolve();
    };
    response.once("drain", done);
    response.once("close", done);
    response.once("error", done);
  });
}
