import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../src/database/prisma.service";
import { PrismaAssistantRepository } from "../src/assistant/infrastructure/prisma-assistant.repository";
import { AssistantActionService } from "../src/assistant/application/assistant-action.service";
import { PrismaAdminArticleCommentRepository } from "../src/comments/infrastructure/prisma-admin-article-comment.repository";
import { UpdateAdminArticleCommentStatusUseCase } from "../src/comments/application/update-admin-article-comment-status.use-case";

const databaseUrl = process.env.ASSISTANT_TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)(
  "Assistant persistence and approved comment transactions on PostgreSQL",
  () => {
    let prisma: PrismaService;
    let repository: PrismaAssistantRepository;
    let actions: AssistantActionService;
    const actor = { id: randomUUID(), login: "assistant-pg-test" };
    const other = { id: randomUUID(), login: "assistant-other-test" };
    const articleId = randomUUID();
    const transcript = {
      version: 1 as const,
      messages: [{ role: "user", content: "request", timestamp: 1 }],
    };
    beforeAll(async () => {
      prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
      repository = new PrismaAssistantRepository(prisma);
      actions = new AssistantActionService(repository);
      for (const user of [actor, other])
        await prisma.user.create({
          data: { ...user, githubId: user.id, profileUrl: "https://example.test/assistant" },
        });
      await prisma.article.create({
        data: {
          id: articleId,
          slug: `assistant-${articleId}`,
          title: "Test article",
          description: "Test",
          markdown: "Test",
          status: "PUBLISHED",
          wordCount: 1,
          readingMinutes: 1,
        },
      });
    });
    afterAll(async () => {
      if (!prisma) return;
      await prisma.$executeRawUnsafe(
        "ALTER TABLE admin_operation_logs DROP CONSTRAINT IF EXISTS assistant_test_reject_audit",
      );
      await prisma.adminOperationLog.deleteMany({
        where: { actorUserId: { in: [actor.id, other.id] } },
      });
      await prisma.assistantConversation.deleteMany({
        where: { ownerUserId: { in: [actor.id, other.id] } },
      });
      await prisma.article.deleteMany({ where: { id: articleId } });
      await prisma.user.deleteMany({ where: { id: { in: [actor.id, other.id] } } });
      await prisma.$disconnect();
    });
    async function fixture(commentId?: string) {
      const conversation = await repository.createConversation(actor.id);
      const { turn } = await repository.admitTurn({
        ownerUserId: actor.id,
        conversationId: conversation.id,
        requestId: "same-local-request",
        input: "Review comment",
        inputHash: "hash",
      });
      const comment = commentId
        ? await prisma.articleComment.findUniqueOrThrow({ where: { id: commentId } })
        : await prisma.articleComment.create({
            data: { articleId, authorId: actor.id, body: "Real server comment", status: "VISIBLE" },
          });
      const identity = { ownerUserId: actor.id, conversationId: conversation.id, turnId: turn.id };
      const prepare = {
        actor,
        conversationId: conversation.id,
        turnId: turn.id,
        toolCallId: `${turn.id}:call_1`,
        commentId: comment.id,
        targetStatus: "HIDDEN" as const,
      };
      return { conversation, turn, comment, identity, prepare };
    }
    it("admits concurrent duplicate identities once, isolates conversations and rejects conflicting or busy requests", async () => {
      const conversation = await repository.createConversation(actor.id);
      const input = {
        ownerUserId: actor.id,
        conversationId: conversation.id,
        requestId: "request",
        input: "Audit",
        inputHash: "same",
      };
      const admitted = await Promise.all([
        repository.admitTurn(input),
        repository.admitTurn(input),
      ]);
      expect(admitted.filter((item) => item.created)).toHaveLength(1);
      expect(admitted[0]!.turn.id).toBe(admitted[1]!.turn.id);
      await expect(repository.admitTurn({ ...input, input: "Different" })).rejects.toMatchObject({
        code: "REQUEST_CONFLICT",
      });
      await expect(repository.admitTurn({ ...input, requestId: "next" })).rejects.toMatchObject({
        code: "CONVERSATION_BUSY",
      });
      await expect(repository.getTurn(other.id, conversation.id, "request")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      const second = await repository.createConversation(actor.id);
      expect((await repository.admitTurn({ ...input, conversationId: second.id })).created).toBe(
        true,
      );
    });
    it("enforces the active-turn partial index and both cancellation/finish compare-and-set directions", async () => {
      const f = await fixture();
      await expect(
        prisma.assistantTurn.create({
          data: {
            conversationId: f.conversation.id,
            requestId: "bypass",
            input: "other",
            inputHash: "other",
          },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      await repository.requestCancellation(actor.id, f.conversation.id, f.turn.id);
      expect(
        (await repository.saveProgress({ ...f.identity, transcript })).transcript.messages,
      ).toEqual([]);
      expect(
        (await repository.finishTurn({ ...f.identity, transcript, status: "COMPLETED" })).status,
      ).toBe("CANCELLING");
      expect((await repository.finishCancellation(f.identity)).status).toBe("CANCELLED");
      expect(
        (
          await repository.admitTurn({
            ownerUserId: actor.id,
            conversationId: f.conversation.id,
            requestId: f.turn.requestId,
            input: f.turn.input,
            inputHash: f.turn.inputHash,
          })
        ).created,
      ).toBe(false);
      const next = await repository.admitTurn({
        ownerUserId: actor.id,
        conversationId: f.conversation.id,
        requestId: "next",
        input: "next",
        inputHash: "next",
      });
      await repository.finishTurn({
        ...f.identity,
        turnId: next.turn.id,
        transcript,
        status: "COMPLETED",
      });
      expect(
        (await repository.requestCancellation(actor.id, f.conversation.id, next.turn.id)).status,
      ).toBe("COMPLETED");
      expect((await repository.getTurn(actor.id, f.conversation.id, "next")).transcript).toEqual(
        transcript,
      );
    });
    it("keeps stopping intent on single-instance startup reconciliation", async () => {
      const running = await fixture();
      const stopping = await fixture();
      await repository.requestCancellation(actor.id, stopping.conversation.id, stopping.turn.id);
      await repository.interruptActiveTurns();
      expect(
        (await repository.getTurn(actor.id, running.conversation.id, running.turn.requestId))
          .status,
      ).toBe("INTERRUPTED");
      expect(
        (await repository.getTurn(actor.id, stopping.conversation.id, stopping.turn.requestId))
          .status,
      ).toBe("CANCELLED");
    });
    it("persists visible real previews, rejects forged identities and never creates a proposal after Stop", async () => {
      const f = await fixture();
      const action = await actions.prepare(f.prepare);
      expect(action).toMatchObject({
        commentBody: f.comment.body,
        currentStatus: "VISIBLE",
        targetStatus: "HIDDEN",
        status: "PENDING",
      });
      expect(
        (await prisma.articleComment.findUniqueOrThrow({ where: { id: f.comment.id } })).status,
      ).toBe("VISIBLE");
      expect((await actions.prepare(f.prepare)).id).toBe(action.id);
      await expect(
        actions.prepare({ ...f.prepare, targetStatus: "VISIBLE" }),
      ).rejects.toMatchObject({ code: "ACTION_CONFLICT" });
      await expect(actions.prepare({ ...f.prepare, actor: other })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await repository.requestCancellation(actor.id, f.conversation.id, f.turn.id);
      await expect(
        actions.prepare({ ...f.prepare, toolCallId: "late-call" }),
      ).rejects.toMatchObject({ code: "TURN_INACTIVE" });
      expect(await repository.listCommentActions(actor.id, f.conversation.id)).toEqual([action]);
      await expect(
        repository.listCommentActions(other.id, f.conversation.id),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("commits one mutation, audit and receipt on double confirm and replays it before current-version checks", async () => {
      const f = await fixture();
      const action = await actions.prepare(f.prepare);
      const confirm = {
        actor,
        conversationId: f.conversation.id,
        actionId: action.id,
        decision: "CONFIRM" as const,
      };
      const results = await Promise.all([actions.decide(confirm), actions.decide(confirm)]);
      expect(results[0]).toEqual(results[1]);
      expect(results[0]!.status).toBe("APPLIED");
      expect(await prisma.adminOperationLog.count({ where: { resourceId: f.comment.id } })).toBe(1);
      expect(
        (await prisma.articleComment.findUniqueOrThrow({ where: { id: f.comment.id } }))
          .moderationVersion,
      ).toBe(1);
      const ordinary = new UpdateAdminArticleCommentStatusUseCase(
        new PrismaAdminArticleCommentRepository(prisma),
      );
      await ordinary.execute({ id: f.comment.id, status: "VISIBLE", actor });
      expect(await actions.decide(confirm)).toEqual(results[0]);
      expect(
        (await prisma.articleComment.findUniqueOrThrow({ where: { id: f.comment.id } })).status,
      ).toBe("VISIBLE");
      expect(await prisma.adminOperationLog.count({ where: { resourceId: f.comment.id } })).toBe(2);
      await expect(actions.decide({ ...confirm, decision: "REJECT" })).rejects.toMatchObject({
        code: "ACTION_CONFLICT",
      });
      await expect(actions.decide({ ...confirm, actor: other })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
    it("allows only one of two stale previews to mutate a target and makes rejection replayable", async () => {
      const f = await fixture();
      const second = await fixture(f.comment.id);
      const previews = await Promise.all([
        actions.prepare(f.prepare),
        actions.prepare(second.prepare),
      ]);
      const results = await Promise.allSettled(
        previews.map((action) =>
          actions.decide({
            actor,
            conversationId: action.conversationId,
            actionId: action.id,
            decision: "CONFIRM",
          }),
        ),
      );
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.find((result) => result.status === "rejected")).toMatchObject({
        reason: { code: "RESOURCE_CHANGED" },
      });
      expect(await prisma.adminOperationLog.count({ where: { resourceId: f.comment.id } })).toBe(1);
      const rejectedIndex = results.findIndex((result) => result.status === "rejected");
      const stale = previews[rejectedIndex]!;
      const decision = {
        actor,
        conversationId: stale.conversationId,
        actionId: stale.id,
        decision: "REJECT" as const,
      };
      const rejected = await actions.decide(decision);
      expect(rejected.status).toBe("REJECTED");
      expect(await actions.decide(decision)).toEqual(rejected);
    });
    it("rolls the comment and receipt back when PostgreSQL rejects the audit, including ordinary HTTP's shared command", async () => {
      const f = await fixture();
      const action = await actions.prepare(f.prepare);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE admin_operation_logs ADD CONSTRAINT assistant_test_reject_audit CHECK (actor_user_id <> '${actor.id}'::uuid) NOT VALID`,
      );
      try {
        await expect(
          actions.decide({
            actor,
            conversationId: f.conversation.id,
            actionId: action.id,
            decision: "CONFIRM",
          }),
        ).rejects.toThrow();
        const ordinary = new UpdateAdminArticleCommentStatusUseCase(
          new PrismaAdminArticleCommentRepository(prisma),
        );
        await expect(
          ordinary.execute({ id: f.comment.id, status: "HIDDEN", actor }),
        ).rejects.toThrow();
      } finally {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE admin_operation_logs DROP CONSTRAINT assistant_test_reject_audit",
        );
      }
      const comment = await prisma.articleComment.findUniqueOrThrow({
        where: { id: f.comment.id },
      });
      expect(comment).toMatchObject({ status: "VISIBLE", moderationVersion: 0 });
      expect((await repository.listCommentActions(actor.id, f.conversation.id))[0]).toMatchObject({
        status: "PENDING",
        receipt: null,
      });
      expect(await prisma.adminOperationLog.count({ where: { resourceId: f.comment.id } })).toBe(0);
    });
  },
);
