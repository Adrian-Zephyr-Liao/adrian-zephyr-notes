import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type AssistantTurn as TurnRecord,
  type AssistantAction as ActionRecord,
} from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { updateCommentStatusWithAudit } from "../../comments/infrastructure/prisma-admin-article-comment.repository";
import {
  AdminArticleCommentConflictError,
  AdminArticleCommentNotFoundError,
} from "../../comments/application/admin-article-comment.errors";
import {
  AssistantRepositoryError,
  type AssistantRepository,
  type AssistantTurnIdentity,
  type AssistantTranscript,
  type AssistantTurn,
  type AssistantAction,
  type AssistantActionReceipt,
  type PrepareAssistantActionInput,
  type DecideAssistantActionInput,
} from "../domain/assistant.repository";

@Injectable()
export class PrismaAssistantRepository implements AssistantRepository {
  constructor(private readonly prisma: PrismaService) {}
  createConversation(ownerUserId: string) {
    return this.prisma.assistantConversation.create({ data: { ownerUserId } });
  }
  async getConversation(ownerUserId: string, conversationId: string) {
    const conversation = await this.prisma.assistantConversation.findFirst({
      where: { id: conversationId, ownerUserId },
    });
    if (!conversation) throw missing();
    return conversation;
  }
  async listTurns(
    ownerUserId: string,
    conversationId: string,
    options: { limit?: number; before?: string } = {},
  ) {
    await this.getConversation(ownerUserId, conversationId);
    const limit = Math.max(1, Math.min(100, Math.floor(options.limit ?? 50)));
    const before = options.before
      ? await this.prisma.assistantTurn.findFirst({ where: { id: options.before, conversationId } })
      : undefined;
    if (options.before && !before) throw missing();
    const records = await this.prisma.assistantTurn.findMany({
      where: {
        conversationId,
        ...(before
          ? {
              OR: [
                { createdAt: { lt: before.createdAt } },
                { createdAt: before.createdAt, id: { lt: before.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    const page = records.slice(0, limit);
    return {
      turns: page.map(toTurn).reverse(),
      nextBefore: records.length > limit ? page.at(-1)!.id : null,
    };
  }
  async getTurn(ownerUserId: string, conversationId: string, requestId: string) {
    const turn = await this.prisma.assistantTurn.findFirst({
      where: { conversationId, requestId, conversation: { ownerUserId } },
    });
    if (!turn) throw missing();
    return toTurn(turn);
  }
  admitTurn(input: {
    ownerUserId: string;
    conversationId: string;
    requestId: string;
    input: string;
    inputHash: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM assistant_conversations WHERE id=${input.conversationId}::uuid AND owner_user_id=${input.ownerUserId}::uuid FOR UPDATE`,
      );
      if (!owned.length) throw missing();
      const existing = await tx.assistantTurn.findUnique({
        where: {
          conversationId_requestId: {
            conversationId: input.conversationId,
            requestId: input.requestId,
          },
        },
      });
      if (existing) {
        if (existing.inputHash !== input.inputHash || existing.input !== input.input)
          throw new AssistantRepositoryError(
            "REQUEST_CONFLICT",
            "This request identity already has different input.",
          );
        return { created: false, turn: toTurn(existing) };
      }
      const active = await tx.assistantTurn.findFirst({
        where: { conversationId: input.conversationId, status: { in: ["RUNNING", "CANCELLING"] } },
      });
      if (active)
        throw new AssistantRepositoryError(
          "CONVERSATION_BUSY",
          "This conversation already has an active request.",
        );
      const turn = await tx.assistantTurn.create({
        data: {
          conversationId: input.conversationId,
          requestId: input.requestId,
          inputHash: input.inputHash,
          input: input.input,
        },
      });
      return { created: true, turn: toTurn(turn) };
    });
  }
  async saveProgress(input: AssistantTurnIdentity & { transcript: AssistantTranscript }) {
    await this.prisma.assistantTurn.updateMany({
      where: this.turnWhere(input, "RUNNING"),
      data: { transcript: json(input.transcript) },
    });
    return this.turnById(input);
  }
  async finishTurn(
    input: AssistantTurnIdentity & {
      status: "COMPLETED" | "FAILED" | "INTERRUPTED";
      transcript: AssistantTranscript;
      errorCode?: string;
    },
  ) {
    await this.prisma.assistantTurn.updateMany({
      where: this.turnWhere(input, "RUNNING"),
      data: {
        status: input.status,
        transcript: json(input.transcript),
        errorCode: input.errorCode ?? null,
      },
    });
    return this.turnById(input);
  }
  async requestCancellation(ownerUserId: string, conversationId: string, turnId: string) {
    const input = { ownerUserId, conversationId, turnId };
    await this.prisma.assistantTurn.updateMany({
      where: this.turnWhere(input, "RUNNING"),
      data: { status: "CANCELLING" },
    });
    return this.turnById(input);
  }
  async finishCancellation(input: AssistantTurnIdentity & { transcript?: AssistantTranscript }) {
    await this.prisma.assistantTurn.updateMany({
      where: this.turnWhere(input, "CANCELLING"),
      data: {
        status: "CANCELLED",
        ...(input.transcript ? { transcript: json(input.transcript) } : {}),
      },
    });
    return this.turnById(input);
  }
  interruptActiveTurns() {
    return this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.assistantTurn.updateMany({
        where: { status: "CANCELLING" },
        data: { status: "CANCELLED" },
      });
      const interrupted = await tx.assistantTurn.updateMany({
        where: { status: "RUNNING" },
        data: { status: "INTERRUPTED", errorCode: "HOST_INTERRUPTED" },
      });
      return cancelled.count + interrupted.count;
    });
  }
  async listCommentActions(ownerUserId: string, conversationId: string, turnId?: string) {
    await this.getConversation(ownerUserId, conversationId);
    const records = await this.prisma.assistantAction.findMany({
      where: { conversationId, ...(turnId ? { turnId } : {}) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return records.map(toAction);
  }
  prepareCommentAction(input: PrepareAssistantActionInput) {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT t.id FROM assistant_turns t JOIN assistant_conversations c ON c.id=t.conversation_id WHERE t.id=${input.turnId}::uuid AND c.id=${input.conversationId}::uuid AND c.owner_user_id=${input.actor.id}::uuid FOR UPDATE OF t`,
      );
      if (!owned.length) throw missing();
      const existing = await tx.assistantAction.findUnique({
        where: { turnId_toolCallId: { turnId: input.turnId, toolCallId: input.toolCallId } },
      });
      if (existing) {
        if (existing.commentId !== input.commentId || existing.targetStatus !== input.targetStatus)
          throw new AssistantRepositoryError(
            "ACTION_CONFLICT",
            "This tool identity already prepared a different action.",
          );
        return toAction(existing);
      }
      const turn = await tx.assistantTurn.findUniqueOrThrow({ where: { id: input.turnId } });
      if (turn.status !== "RUNNING")
        throw new AssistantRepositoryError("TURN_INACTIVE", "The request is no longer active.");
      const comment = await tx.articleComment.findUnique({
        where: { id: input.commentId },
        include: { article: { select: { title: true } }, author: { select: { login: true } } },
      });
      if (!comment) throw missing();
      return toAction(
        await tx.assistantAction.create({
          data: {
            conversationId: input.conversationId,
            turnId: input.turnId,
            toolCallId: input.toolCallId,
            commentId: comment.id,
            currentStatus: comment.status,
            targetStatus: input.targetStatus,
            targetVersion: comment.moderationVersion,
            preview: {
              commentBody: comment.body,
              authorLogin: comment.author.login,
              articleTitle: comment.article.title,
            },
          },
        }),
      );
    });
  }
  decideCommentAction(input: DecideAssistantActionInput) {
    return this.prisma.$transaction(async (tx) => {
      const owned = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT a.id FROM assistant_actions a JOIN assistant_conversations c ON c.id=a.conversation_id WHERE a.id=${input.actionId}::uuid AND c.id=${input.conversationId}::uuid AND c.owner_user_id=${input.actor.id}::uuid FOR UPDATE OF a`,
      );
      if (!owned.length) throw missing();
      const action = await tx.assistantAction.findUniqueOrThrow({ where: { id: input.actionId } });
      if (action.status !== "PENDING") {
        if (
          (action.status === "APPLIED" && input.decision === "CONFIRM") ||
          (action.status === "REJECTED" && input.decision === "REJECT")
        )
          return toAction(action);
        throw new AssistantRepositoryError(
          "ACTION_CONFLICT",
          "A different decision was already saved for this action.",
        );
      }
      const decidedAt = new Date();
      if (input.decision === "REJECT")
        return toAction(
          await tx.assistantAction.update({
            where: { id: action.id },
            data: { status: "REJECTED", decidedAt, decidedByUserId: input.actor.id },
          }),
        );
      try {
        const applied = await updateCommentStatusWithAudit(tx, {
          id: action.commentId,
          status: action.targetStatus,
          expectedVersion: action.targetVersion,
          actor: input.actor,
          requestContext: input.requestContext,
          assistantActionId: action.id,
        });
        const receipt: AssistantActionReceipt = {
          actionId: action.id,
          commentId: action.commentId,
          previousStatus: applied.previousStatus,
          status: applied.comment.status,
          auditLogId: applied.auditLogId,
          appliedAt: decidedAt.toISOString(),
        };
        return toAction(
          await tx.assistantAction.update({
            where: { id: action.id },
            data: {
              status: "APPLIED",
              decidedAt,
              decidedByUserId: input.actor.id,
              receipt: json(receipt),
            },
          }),
        );
      } catch (error) {
        if (
          error instanceof AdminArticleCommentConflictError ||
          error instanceof AdminArticleCommentNotFoundError
        )
          throw new AssistantRepositoryError(
            "RESOURCE_CHANGED",
            "The comment changed after this preview. Prepare a new action.",
          );
        throw error;
      }
    });
  }
  private turnWhere(input: AssistantTurnIdentity, status: "RUNNING" | "CANCELLING") {
    return {
      id: input.turnId,
      conversationId: input.conversationId,
      status,
      conversation: { ownerUserId: input.ownerUserId },
    };
  }
  private async turnById(input: AssistantTurnIdentity) {
    const turn = await this.prisma.assistantTurn.findFirst({
      where: {
        id: input.turnId,
        conversationId: input.conversationId,
        conversation: { ownerUserId: input.ownerUserId },
      },
    });
    if (!turn) throw missing();
    return toTurn(turn);
  }
}
function missing() {
  return new AssistantRepositoryError("NOT_FOUND", "Assistant resource not found.");
}
function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
function toTurn(record: TurnRecord): AssistantTurn {
  const transcript = record.transcript as unknown as AssistantTranscript;
  if (transcript?.version !== 1 || !Array.isArray(transcript.messages))
    throw new Error("Unsupported assistant transcript format.");
  return { ...record, transcript };
}
function toAction(record: ActionRecord): AssistantAction {
  const preview = record.preview as Record<string, string>;
  return {
    id: record.id,
    conversationId: record.conversationId,
    turnId: record.turnId,
    status: record.status,
    commentId: record.commentId,
    currentStatus: record.currentStatus,
    targetStatus: record.targetStatus,
    commentBody: preview.commentBody,
    authorLogin: preview.authorLogin,
    articleTitle: preview.articleTitle,
    createdAt: record.createdAt.toISOString(),
    decidedAt: record.decidedAt?.toISOString() ?? null,
    receipt: record.receipt as AssistantActionReceipt | null,
  };
}
