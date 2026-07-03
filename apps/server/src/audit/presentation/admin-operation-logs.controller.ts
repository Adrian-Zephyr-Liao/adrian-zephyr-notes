import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { AdminOperationLogListResponse } from "@adrian-zephyr-notes/contracts";
import { AdminAuthGuard } from "../../auth/presentation/admin-auth.guard";
import { ListAdminOperationLogsUseCase } from "../application/list-admin-operation-logs.use-case";
import { toAdminOperationLogListResponse } from "../infrastructure/admin-operation-log.mapper";
import { AdminOperationLogListQueryDto } from "./dto/admin-operation-log-list-query.dto";

@Controller("api/admin/audit/logs")
@UseGuards(AdminAuthGuard)
class AdminOperationLogsController {
  constructor(private readonly listAdminOperationLogs: ListAdminOperationLogsUseCase) {}

  @Get()
  async list(
    @Query() query: AdminOperationLogListQueryDto,
  ): Promise<AdminOperationLogListResponse> {
    const result = await this.listAdminOperationLogs.execute({
      page: query.page,
      pageSize: query.pageSize,
      action: query.action,
      actorLogin: query.actorLogin,
      search: query.q,
    });

    return toAdminOperationLogListResponse(result);
  }
}

export { AdminOperationLogsController };
