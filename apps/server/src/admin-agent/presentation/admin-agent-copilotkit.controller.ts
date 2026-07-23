import { All, Controller, Inject, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import {
  CopilotSseRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import type { AuthUser } from "../../auth/domain/auth-user.entity";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { CurrentAdmin } from "../../auth/presentation/current-admin.decorator";
import {
  toAdminOperationActor,
  toAdminOperationRequestContext,
} from "../../audit/presentation/admin-audit-context";
import { SendAdminAgentChatMessageUseCase } from "../application/send-admin-agent-chat-message.use-case";
import {
  ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY,
  type AdminAgentChatMessageRepository,
} from "../domain/admin-agent-chat-message.repository";
import { AdminAgentAgUiAgent } from "../infrastructure/admin-agent-copilotkit-agent";
import { AdminAgentCommentTools } from "../infrastructure/tools/admin-agent-comment-tools";

@Controller("api")
@UseGuards(AdminAuthGuard)
class AdminAgentCopilotKitController {
  private readonly runner = new InMemoryAgentRunner();

  constructor(
    private readonly sendChatMessage: SendAdminAgentChatMessageUseCase,
    private readonly commentTools: AdminAgentCommentTools,
    @Inject(ADMIN_AGENT_CHAT_MESSAGE_REPOSITORY)
    private readonly chatMessageRepository: AdminAgentChatMessageRepository,
  ) {}

  @All("copilotkit")
  async handle(
    @Req() request: Request,
    @Res() response: Response,
    @CurrentAdmin() admin: AuthUser,
  ): Promise<void> {
    const runtime = new CopilotSseRuntime({
      a2ui: {
        agents: ["admin-agent"],
        injectA2UITool: false,
        recovery: {
          debugExposure: "hidden",
          showProgressTokens: false,
        },
      },
      agents: {
        "admin-agent": new AdminAgentAgUiAgent({
          actorUserId: admin.id,
          chatMessageRepository: this.chatMessageRepository,
          sendChatMessage: this.sendChatMessage,
          serverTools: this.commentTools.create({
            actor: toAdminOperationActor(admin),
            requestContext: toAdminOperationRequestContext(request),
            startedByUserId: admin.id,
          }),
        }),
      },
      runner: this.runner,
    });
    const handler = createCopilotRuntimeHandler({
      basePath: "/api/copilotkit",
      mode: "single-route",
      runtime,
    });
    const copilotKitResponse = await handler(toFetchRequest(request));

    await writeFetchResponse(response, copilotKitResponse);
  }
}

function toFetchRequest(request: Request) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? toFetchRequestBody(request, headers) : undefined;
  const origin = `${request.protocol}://${request.get("host") ?? "localhost"}`;

  if (body !== undefined) {
    headers.delete("content-length");
  }

  return new Request(new URL(request.originalUrl, origin), {
    body,
    duplex: body instanceof ReadableStream ? "half" : undefined,
    headers,
    method,
  } as RequestInit);
}

function toFetchRequestBody(request: Request, headers: Headers): BodyInit | undefined {
  if (request.body !== undefined) {
    if (Buffer.isBuffer(request.body)) {
      return new Uint8Array(request.body);
    }

    if (typeof request.body === "string") {
      return request.body;
    }

    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }

    return JSON.stringify(request.body);
  }

  return request.readableEnded ? undefined : (Readable.toWeb(request) as unknown as ReadableStream);
}

async function writeFetchResponse(response: Response, fetchResponse: globalThis.Response) {
  response.status(fetchResponse.status);
  fetchResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });

  if (!fetchResponse.body) {
    response.end();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    Readable.fromWeb(fetchResponse.body as unknown as Parameters<typeof Readable.fromWeb>[0])
      .on("error", reject)
      .on("end", resolve)
      .pipe(response);
  });
}

export { AdminAgentCopilotKitController };
