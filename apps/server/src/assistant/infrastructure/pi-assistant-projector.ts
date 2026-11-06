import type {
  AssistantMessage,
  AssistantToolResult,
  AssistantToolResultResponse,
} from "@adrian-zephyr-notes/contracts";
import type { AssistantCanonicalMessage } from "../application/assistant-runner.port";

export function assistantMessageId(turnId: string, index: number) {
  return `${turnId}:message:${index}`;
}
export function assistantToolCallId(turnId: string, providerCallId: string, messageIndex: number) {
  return `${turnId}:${messageIndex}:${providerCallId}`;
}
export function assistantMessageText(message: AssistantCanonicalMessage) {
  return typeof message.content === "string"
    ? message.content
    : message.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
}
export function isAssistantToolResult(value: unknown): value is AssistantToolResult {
  if (!value || typeof value !== "object" || !("kind" in value) || !("ok" in value)) return false;
  return (
    ["audit_logs", "comments", "comment_action"].includes(String(value.kind)) &&
    (value.ok === true
      ? "data" in value && !!value.data && typeof value.data === "object"
      : value.ok === false && "error" in value && !!value.error && typeof value.error === "object")
  );
}
export function projectAssistantTranscript(turnId: string, canonical: AssistantCanonicalMessage[]) {
  const messages: AssistantMessage[] = [];
  const toolResults: AssistantToolResultResponse[] = [];
  const callIds = new Map<string, string>();
  canonical.forEach((message, index) => {
    if (message.role === "assistant") {
      callIds.clear();
      const calls = message.content.filter((block) => block.type === "toolCall");
      if (new Set(calls.map((call) => call.id)).size !== calls.length)
        throw new Error("Assistant message has duplicate tool call IDs.");
      for (const call of calls) callIds.set(call.id, assistantToolCallId(turnId, call.id, index));
    }
    if (message.role === "user" || message.role === "assistant") {
      const content = assistantMessageText(message);
      if (content)
        messages.push({ id: assistantMessageId(turnId, index), role: message.role, content });
    } else if (
      message.role === "toolResult" &&
      isAssistantToolResult(message.details) &&
      callIds.has(message.toolCallId)
    ) {
      toolResults.push({
        toolCallId: callIds.get(message.toolCallId)!,
        name: message.toolName,
        result: message.details,
      });
    }
  });
  return { messages, toolResults };
}
export function projectAssistantMessages(turnId: string, canonical: AssistantCanonicalMessage[]) {
  return projectAssistantTranscript(turnId, canonical).messages;
}
