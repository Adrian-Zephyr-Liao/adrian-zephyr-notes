import { Inject, Injectable } from "@nestjs/common";
import { normalizeCommentStatus } from "../../comments/application/update-admin-article-comment-status.use-case";
import {
  ASSISTANT_REPOSITORY,
  type AssistantRepository,
  type PrepareAssistantActionInput,
  type DecideAssistantActionInput,
} from "../domain/assistant.repository";

@Injectable()
export class AssistantActionService {
  constructor(@Inject(ASSISTANT_REPOSITORY) private readonly repository: AssistantRepository) {}
  prepare(input: PrepareAssistantActionInput) {
    return this.repository.prepareCommentAction({
      ...input,
      targetStatus: normalizeCommentStatus(input.targetStatus),
    });
  }
  decide(input: DecideAssistantActionInput) {
    if (input.decision !== "CONFIRM" && input.decision !== "REJECT")
      throw new Error("Unsupported action decision.");
    return this.repository.decideCommentAction(input);
  }
}
