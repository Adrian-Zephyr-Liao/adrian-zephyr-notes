import type { Message } from "@earendil-works/pi-ai";
import type { AssistantError, AssistantToolResult } from "@adrian-zephyr-notes/contracts";

export type AssistantCanonicalMessage = Message;
export type AssistantToolExecutionContext = {
  turnId: string;
  toolCallId: string;
  signal: AbortSignal;
};
export type AssistantToolDefinition = {
  name: string;
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  kind: AssistantToolResult["kind"];
  readOnly: boolean;
  execute(
    args: Record<string, unknown>,
    context: AssistantToolExecutionContext,
  ): Promise<AssistantToolResult>;
};
export type AssistantRunnerInput = {
  turnId: string;
  message: string;
  messages: AssistantCanonicalMessage[];
  tools: AssistantToolDefinition[];
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
      toolCallId: string;
      name: string;
      content: string;
      isError: boolean;
      result?: AssistantToolResult;
    }
  | { type: "messages"; messages: AssistantCanonicalMessage[] }
  | {
      type: "finished";
      status: "SUCCEEDED" | "CANCELLED" | "FAILED";
      messages: AssistantCanonicalMessage[];
      error?: AssistantError;
    };

export interface AssistantRunner {
  stream(input: AssistantRunnerInput): AsyncIterable<AssistantRuntimeEvent>;
}
export const ASSISTANT_RUNNER = Symbol("ASSISTANT_RUNNER");
export class AssistantToolInputError extends Error {
  readonly code = "TOOL_INPUT_INVALID";
}
