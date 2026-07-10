import { IsIn } from "class-validator";
import {
  adminAgentTaskCatalog,
  type ControlAdminAgentTaskRequest,
} from "@adrian-zephyr-notes/contracts";

const adminAgentTaskControlActions = [
  ...new Set(
    adminAgentTaskCatalog.flatMap((task) => task.controls.map((control) => control.action)),
  ),
];

class ControlAdminAgentTaskDto implements ControlAdminAgentTaskRequest {
  @IsIn(adminAgentTaskControlActions)
  action!: ControlAdminAgentTaskRequest["action"];
}

export { ControlAdminAgentTaskDto };
