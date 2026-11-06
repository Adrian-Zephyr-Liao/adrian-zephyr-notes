import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigService } from "@nestjs/config";
import { Client } from "pg";
import { PrismaService } from "../src/database/prisma.service";
import { ListAdminOperationLogsUseCase } from "../src/audit/application/list-admin-operation-logs.use-case";
import { PrismaAdminOperationLogRepository } from "../src/audit/infrastructure/prisma-admin-operation-log.repository";
import { ListAdminArticleCommentsUseCase } from "../src/comments/application/list-admin-article-comments.use-case";
import { PrismaAdminArticleCommentRepository } from "../src/comments/infrastructure/prisma-admin-article-comment.repository";

const databaseUrl = process.env.ASSISTANT_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("Assistant PostgreSQL read statement deadlines", () => {
  let prisma: PrismaService;
  let blocker: Client;
  let audit: ListAdminOperationLogsUseCase;
  let comments: ListAdminArticleCommentsUseCase;

  beforeAll(async () => {
    prisma = new PrismaService(new ConfigService({ DATABASE_URL: databaseUrl }));
    blocker = new Client({ connectionString: databaseUrl });
    await blocker.connect();
    await prisma.$connect();
    audit = new ListAdminOperationLogsUseCase(new PrismaAdminOperationLogRepository(prisma));
    comments = new ListAdminArticleCommentsUseCase(new PrismaAdminArticleCommentRepository(prisma));
  });

  afterAll(async () => {
    await blocker?.end();
    await prisma?.$disconnect();
  });

  it.each(["audit", "comments"] as const)(
    "cancels the real blocked %s query in PostgreSQL and leaves ordinary UI queries unchanged",
    async (kind) => {
      const useCase = kind === "audit" ? audit : comments;
      await blocker.query("BEGIN");
      try {
        await blocker.query(
          kind === "audit"
            ? "LOCK TABLE admin_operation_logs IN ACCESS EXCLUSIVE MODE"
            : "LOCK TABLE article_comments IN ACCESS EXCLUSIVE MODE",
        );
        await expect(useCase.execute({}, { statementTimeoutMs: 50 })).rejects.toThrow(
          /statement timeout/,
        );

        // A subsequent ordinary query must keep waiting until the lock is released.
        const ordinaryQuery = expect(useCase.execute()).resolves.toMatchObject({
          data: expect.any(Array),
          pagination: { page: 1, pageSize: 20 },
        });
        await blocker.query("SELECT pg_sleep(0.1)");
        await blocker.query("ROLLBACK");
        await ordinaryQuery;
        expect(
          await prisma.$queryRaw<
            Array<{ timeout: string }>
          >`SELECT current_setting('statement_timeout') AS timeout`,
        ).toEqual([{ timeout: "0" }]);
      } finally {
        await blocker.query("ROLLBACK");
      }
    },
  );

  it.each([0, -1, 5001, Number.NaN])("rejects a disabled or invalid timeout of %s", async (ms) => {
    await expect(audit.execute({}, { statementTimeoutMs: ms })).rejects.toThrow(RangeError);
    await expect(comments.execute({}, { statementTimeoutMs: ms })).rejects.toThrow(RangeError);
  });
});
