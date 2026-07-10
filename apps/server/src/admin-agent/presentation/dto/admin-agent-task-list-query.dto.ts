import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import {
  adminAgentTaskCatalog,
  type AdminAgentTaskListQuery,
} from "@adrian-zephyr-notes/contracts";

const adminAgentTaskListTaskNames = [
  "ALL",
  ...adminAgentTaskCatalog.map((task) => task.taskName),
] as const;

class AdminAgentTaskListQueryDto implements AdminAgentTaskListQuery {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  pageSize?: number;

  @IsString()
  @IsOptional()
  parentTaskId?: string;

  @IsIn(["ALL", "branch", "child", "retry"])
  @IsOptional()
  relation?: AdminAgentTaskListQuery["relation"];

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => toOptionalQueryBoolean(value))
  rootOnly?: boolean;

  @IsIn(["ALL", "CANCELLED", "COMPLETED", "FAILED", "PENDING", "RUNNING", "WAITING_FOR_APPROVAL"])
  @IsOptional()
  status?: AdminAgentTaskListQuery["status"];

  @IsIn(adminAgentTaskListTaskNames)
  @IsOptional()
  taskName?: AdminAgentTaskListQuery["taskName"];
}

export { AdminAgentTaskListQueryDto };

function toOptionalQueryBoolean(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return value;
}
