import { Inject, Injectable } from "@nestjs/common";
import type {
  AdminAgentWorkflowDefinition,
  AdminAgentWorkflowRegistry,
} from "../domain/admin-agent-workflow-definition";
import {
  ADMIN_AGENT_WORKFLOW_RUNNER,
  type AdminAgentWorkflowRunner,
} from "../domain/admin-agent-workflow-runner";
import { listAdminAgentWorkflowMetadata } from "../domain/admin-agent-workflow-metadata";

@Injectable()
class RegisteredAdminAgentWorkflowRegistry implements AdminAgentWorkflowRegistry {
  constructor(
    @Inject(ADMIN_AGENT_WORKFLOW_RUNNER)
    private readonly adminAgentWorkflowRunner: AdminAgentWorkflowRunner,
  ) {}

  findByName(workflowName: AdminAgentWorkflowDefinition["workflowName"]) {
    return (
      this.listDefinitions().find((definition) => definition.workflowName === workflowName) ?? null
    );
  }

  listDefinitions(): AdminAgentWorkflowDefinition[] {
    return listAdminAgentWorkflowMetadata().map((metadata) => ({
      branch: (input) =>
        this.adminAgentWorkflowRunner.branchWorkflow({
          ...input,
          workflowName: metadata.workflowName,
        }),
      refresh: (input) =>
        this.adminAgentWorkflowRunner.refreshWorkflow({
          ...input,
          workflowName: metadata.workflowName,
        }),
      resume: (input) =>
        this.adminAgentWorkflowRunner.resumeWorkflow({
          ...input,
          workflowName: metadata.workflowName,
        }),
      runType: metadata.runType,
      start: (input) =>
        this.adminAgentWorkflowRunner.startWorkflow({
          ...input,
          workflowName: metadata.workflowName,
        }),
      workflowName: metadata.workflowName,
    }));
  }
}

export { RegisteredAdminAgentWorkflowRegistry };
