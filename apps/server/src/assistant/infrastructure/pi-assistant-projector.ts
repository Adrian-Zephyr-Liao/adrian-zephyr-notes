import type {
  AssistantMessage,
  AssistantToolResult,
  AssistantToolResultResponse,
} from "@adrian-zephyr-notes/contracts";
import type { Message } from "@earendil-works/pi-ai";
import type { AssistantAction } from "../domain/assistant.repository";

export function readAssistantMessages(messages: unknown[]): Message[] {
  const invalid = () => new Error("Canonical assistant history contains an unsupported message.");
  for (const message of messages) {
    if (!record(message) || !["user", "assistant", "toolResult"].includes(String(message.role)))
      throw invalid();
    if (
      message.role === "toolResult" &&
      (typeof message.toolCallId !== "string" ||
        !message.toolCallId ||
        typeof message.toolName !== "string" ||
        !message.toolName ||
        typeof message.isError !== "boolean")
    )
      throw invalid();
    if (message.role === "user" && typeof message.content === "string") continue;
    if (!Array.isArray(message.content)) throw invalid();
    for (const block of message.content) {
      if (!record(block)) throw invalid();
      if (block.type === "text" && typeof block.text === "string") continue;
      if (message.role === "assistant") {
        if (block.type === "thinking" && typeof block.thinking === "string") continue;
        if (
          block.type === "toolCall" &&
          typeof block.id === "string" &&
          block.id &&
          typeof block.name === "string" &&
          block.name
        )
          continue;
      } else if (
        block.type === "image" &&
        typeof block.data === "string" &&
        typeof block.mimeType === "string"
      )
        continue;
      throw invalid();
    }
  }
  // Validate only the fields consumed here; keep provider signatures and metadata intact.
  return messages as Message[];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function assistantMessageId(turnId: string, index: number) {
  return `${turnId}:message:${index}`;
}
export function assistantToolCallId(turnId: string, providerCallId: string, messageIndex: number) {
  return `${turnId}:${messageIndex}:${providerCallId}`;
}
export function assistantMessageText(message: Message) {
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
export function projectAssistantTranscript(turnId: string, canonical: Message[]) {
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
export function refreshActionMessages(messages: Message[], actions: AssistantAction[]): Message[] {
  const currentActions = new Map(actions.map((action) => [action.id, action]));
  return messages.map((message) => {
    if (
      message.role !== "toolResult" ||
      !isAssistantToolResult(message.details) ||
      !message.details.ok ||
      message.details.kind !== "comment_action"
    )
      return message;
    const current = currentActions.get(message.details.data.id);
    if (!current) return message;
    const details = { kind: "comment_action" as const, ok: true as const, data: current };
    return { ...message, details, content: [{ type: "text", text: JSON.stringify(details) }] };
  });
}
