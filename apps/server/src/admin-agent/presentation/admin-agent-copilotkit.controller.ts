import { All, Controller, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotRuntimeHandler,
} from "@copilotkit/runtime/v2";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { SendAdminAgentChatMessageUseCase } from "../application/send-admin-agent-chat-message.use-case";
import { AdminAgentCopilotKitAgent } from "../infrastructure/admin-agent-copilotkit-agent";

@Controller("api")
@UseGuards(AdminAuthGuard)
class AdminAgentCopilotKitController {
  private readonly runner = new InMemoryAgentRunner();

  constructor(private readonly sendChatMessage: SendAdminAgentChatMessageUseCase) {}

  @All("copilotkit")
  async handle(@Req() request: Request, @Res() response: Response): Promise<void> {
    const runtime = new CopilotRuntime({
      agents: {
        "admin-agent": new AdminAgentCopilotKitAgent({
          sendChatMessage: this.sendChatMessage,
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
