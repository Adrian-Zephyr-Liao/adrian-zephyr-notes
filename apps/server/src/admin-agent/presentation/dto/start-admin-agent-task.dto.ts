import { IsIn, IsObject, IsOptional } from "class-validator";
import {
  startableAdminAgentTaskNames,
  type StartAdminAgentTaskRequest,
} from "@adrian-zephyr-notes/contracts";

class StartAdminAgentTaskDto implements StartAdminAgentTaskRequest {
  @IsObject()
  @IsOptional()
  input?: Record<string, unknown> | null;

  @IsIn(startableAdminAgentTaskNames)
  taskName!: StartAdminAgentTaskRequest["taskName"];
}

export { StartAdminAgentTaskDto };
