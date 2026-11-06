import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { AdminOperationLogListResponse } from "@adrian-zephyr-notes/contracts";
import {
  AdminApiAccess,
  AdminApiAccessGuard,
} from "../../oauth/presentation/admin-api-access.guard";
import { ListAdminOperationLogsUseCase } from "../application/list-admin-operation-logs.use-case";
import { toAdminOperationLogListResponse } from "../infrastructure/admin-operation-log.mapper";
import { AdminOperationLogListQueryDto } from "./dto/admin-operation-log-list-query.dto";

@Controller("api/admin/audit/logs")
@UseGuards(AdminApiAccessGuard)
class AdminOperationLogsController {
  constructor(private readonly listAdminOperationLogs: ListAdminOperationLogsUseCase) {}

  @Get()
  @AdminApiAccess("admin:read")
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
