import type {
  AssistantCapabilitiesResponse,
  AssistantError,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import type { AssistantAction, AssistantTranscript } from "../domain/assistant.repository";

export type AssistantToolsContext = {
  actor: { id: string; login: string };
  conversationId: string;
  turnId: string;
  actionsEnabled: boolean;
};
export type AssistantRunnerInput = AssistantToolsContext & {
  message: string;
  transcripts: AssistantTranscript[];
  actions: AssistantAction[];
  signal?: AbortSignal;
  authorizeTool?: (name: string, args: unknown, signal: AbortSignal) => void | Promise<void>;
};
export type AssistantRuntimeEvent =
  | { type: "textStart"; messageId: string }
  | { type: "textDelta"; messageId: string; delta: string }
  | { type: "textEnd"; messageId: string }
  | { type: "toolStart"; toolCallId: string; parentMessageId: string; name: string; args: unknown }
  | {
      type: "toolResult";
      messageId: string;
      toolCallId: string;
      name: string;
      content: string;
    }
  | { type: "messages"; messages: unknown[] }
  | {
      type: "finished";
      status: "SUCCEEDED" | "CANCELLED" | "FAILED";
      messages: unknown[];
      error?: AssistantError;
    };

export type AssistantEvent =
  | Exclude<AssistantRuntimeEvent, { type: "messages" | "finished" }>
  | { type: "runStarted"; threadId: string; runId: string }
  | { type: "runFinished"; threadId: string; runId: string }
  | { type: "runError"; code: string; message: string };

export interface AssistantRunner {
  isConfigured(): boolean;
  capabilities(context: AssistantToolsContext): AssistantCapabilitiesResponse["tools"];
  project(
    turnId: string,
    transcript: AssistantTranscript,
  ): Pick<AssistantTurnResponse, "messages" | "toolResults">;
  stream(input: AssistantRunnerInput): AsyncIterable<AssistantRuntimeEvent>;
}
export const ASSISTANT_RUNNER = Symbol("ASSISTANT_RUNNER");
