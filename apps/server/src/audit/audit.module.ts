import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../database/prisma.module";
import { ListAdminOperationLogsUseCase } from "./application/list-admin-operation-logs.use-case";
import { RecordAdminOperationUseCase } from "./application/record-admin-operation.use-case";
import { ADMIN_OPERATION_LOG_REPOSITORY } from "./domain/admin-operation-log.repository";
import { PrismaAdminOperationLogRepository } from "./infrastructure/prisma-admin-operation-log.repository";
import { AdminOperationLogsController } from "./presentation/admin-operation-logs.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AdminOperationLogsController],
  providers: [
    ListAdminOperationLogsUseCase,
    RecordAdminOperationUseCase,
    {
      provide: ADMIN_OPERATION_LOG_REPOSITORY,
      useClass: PrismaAdminOperationLogRepository,
    },
  ],
  exports: [ListAdminOperationLogsUseCase, RecordAdminOperationUseCase],
})
export class AuditModule {}
