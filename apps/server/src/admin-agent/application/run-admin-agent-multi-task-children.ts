import type { AdminAgentRepository } from "../domain/admin-agent.repository";
import type { AdminAgentRun } from "../domain/admin-agent-run.entity";
import type {
  AdminAgentWorkflowResult,
  StartAdminAgentWorkflowRunnerInput,
} from "../domain/admin-agent-workflow-runner";
import type {
  MultiTaskChildResult,
  MultiTaskChildWorkflowName,
  MultiTaskPlanItem,
} from "../domain/admin-agent-multi-task-orchestration";
import {
  createMultiTaskChildFailureResult,
  createMultiTaskChildResultFromWorkflowResult,
  toMultiTaskChildDedupeKey,
  toMultiTaskChildResult,
  toWorkflowRunDedupeKey,
} from "../domain/admin-agent-multi-task-orchestration";
import { toAdminAgentWorkflowFailureMessage } from "../domain/admin-agent-workflow-output";

type StartAdminAgentMultiTaskChildWorkflowInput = StartAdminAgentWorkflowRunnerInput & {
  dedupeKey: string;
  input: Record<string, unknown>;
  parentRunId: string;
  startReason: "CHAT_INTENT";
  workflowName: MultiTaskChildWorkflowName;
};

type StartAdminAgentMultiTaskChildWorkflow = (
  input: StartAdminAgentMultiTaskChildWorkflowInput,
) => Promise<AdminAgentWorkflowResult>;

type RunAdminAgentMultiTaskChildrenInput = {
  listRunsPageSize?: number;
  parentRunId: string;
  plan: MultiTaskPlanItem[];
  repository: Pick<AdminAgentRepository, "listRuns">;
  startChildWorkflow: StartAdminAgentMultiTaskChildWorkflow;
  startedByUserId: string | null;
};

const defaultMultiTaskChildRunLookupLimit = 50;

async function runAdminAgentMultiTaskChildren(
  input: RunAdminAgentMultiTaskChildrenInput,
): Promise<MultiTaskChildResult[]> {
  const existingChildren = await listExistingMultiTaskChildRuns(input);
  const existingChildrenByDedupeKey = new Map(
    existingChildren
      .map((run) => [toWorkflowRunDedupeKey(run), run] as const)
      .filter((entry): entry is readonly [string, AdminAgentRun] => Boolean(entry[0])),
  );
  const childResults: MultiTaskChildResult[] = [];

  for (const [index, item] of input.plan.entries()) {
    const dedupeKey = toMultiTaskChildDedupeKey(input.parentRunId, index, item);
    const existingChild = existingChildrenByDedupeKey.get(dedupeKey);

    if (existingChild) {
      const effectiveChild = await resolveEffectiveMultiTaskChildRun(
        input.repository,
        existingChild,
      );
      childResults.push({
        ...toMultiTaskChildResult(effectiveChild),
        childTaskKey: toWorkflowRunDedupeKey(effectiveChild) ?? dedupeKey,
      });
      continue;
    }

    try {
      const result = await input.startChildWorkflow({
        dedupeKey,
        input: item.input,
        parentRunId: input.parentRunId,
        startedByUserId: input.startedByUserId,
        startReason: "CHAT_INTENT",
        workflowName: item.workflowName,
      });

      childResults.push(
        createMultiTaskChildResultFromWorkflowResult({
          result,
          workflowName: item.workflowName,
        }),
      );
    } catch (error) {
      const message = toAdminAgentWorkflowFailureMessage(error);

      childResults.push(
        createMultiTaskChildFailureResult({
          childTaskKey: dedupeKey,
          errorMessage: message,
          runId: toWorkflowExecutionRunId(error),
          workflowName: item.workflowName,
        }),
      );
    }
  }

  return childResults;
}

async function listExistingMultiTaskChildRuns(input: RunAdminAgentMultiTaskChildrenInput) {
  const pageSize = input.listRunsPageSize ?? defaultMultiTaskChildRunLookupLimit;
  const existingChildren: AdminAgentRun[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await input.repository.listRuns({
      page,
      pageSize,
      parentRunId: input.parentRunId,
      parentRunRelation: "CHILD_TASK",
    });

    existingChildren.push(...result.data);
    totalPages = result.pagination.totalPages;
    page += 1;
  } while (page <= totalPages);

  return existingChildren;
}

async function resolveEffectiveMultiTaskChildRun(
  repository: Pick<AdminAgentRepository, "listRuns">,
  childRun: AdminAgentRun,
) {
  const retryRuns = await repository.listRuns({
    page: 1,
    pageSize: 1,
    parentRunId: childRun.id,
    parentRunRelation: "RETRY",
  });

  return retryRuns.data[0] ?? childRun;
}

function toWorkflowExecutionRunId(error: unknown) {
  if (!error || typeof error !== "object" || !("runId" in error)) {
    return null;
  }

  const runId = (error as { runId?: unknown }).runId;

  return typeof runId === "string" && runId.trim() ? runId.trim() : null;
}

export { runAdminAgentMultiTaskChildren };
export type {
  RunAdminAgentMultiTaskChildrenInput,
  StartAdminAgentMultiTaskChildWorkflow,
  StartAdminAgentMultiTaskChildWorkflowInput,
};
