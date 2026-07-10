import { isAgentTaskResumeOperation } from "./agent-operation-executor";
import type { AskUserChoiceOperation, AskUserQuestionArgs } from "./agent-human-in-loop-contracts";

function resolveChoiceOperations(
  choice: AskUserQuestionArgs["choices"][number],
): AskUserChoiceOperation[] {
  return sanitizeChoiceOperations(choice.operations ?? []);
}

function sanitizeChoiceOperations(operations: unknown[]) {
  const sanitizedOperations: AskUserChoiceOperation[] = [];

  for (const operation of operations) {
    if (isAgentTaskResumeOperation(operation)) {
      sanitizedOperations.push(operation);
    }
  }

  return sanitizedOperations;
}

export { resolveChoiceOperations };
