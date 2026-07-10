import { IsNotEmptyObject, IsObject } from "class-validator";
import type { ResumeAdminAgentTaskRequest } from "@adrian-zephyr-notes/contracts";

class ResumeAdminAgentTaskDto implements ResumeAdminAgentTaskRequest {
  @IsNotEmptyObject()
  @IsObject()
  resume!: Record<string, unknown>;
}

export { ResumeAdminAgentTaskDto };
