import type { Message, ToolCall } from "@ag-ui/client";
import { UseAgentUpdate, useAgent, useRenderToolCall } from "@copilotkit/react-core/v2";

const adminAgentId = "admin-agent";

function AgentToolCallMessage({ toolCallId }: { toolCallId: string }) {
  const { agent } = useAgent({
    agentId: adminAgentId,
    updates: [UseAgentUpdate.OnMessagesChanged],
  });
  const renderToolCall = useRenderToolCall();
  const toolCall = agent.messages
    .flatMap((message) => (message.role === "assistant" ? (message.toolCalls ?? []) : []))
    .find((candidate) => candidate.id === toolCallId);

  if (!toolCall) {
    return null;
  }

  return (
    <div className="flex justify-start">
      {renderToolCall({
        toolCall,
        toolMessage: findToolMessage(agent.messages, toolCall),
      })}
    </div>
  );
}

function findToolMessage(messages: Message[], toolCall: ToolCall): ToolMessage | undefined {
  const message = messages.find(
    (candidate) => candidate.role === "tool" && candidate.toolCallId === toolCall.id,
  );

  return message?.role === "tool" ? message : undefined;
}

type ToolMessage = Extract<Message, { role: "tool" }>;

export { AgentToolCallMessage };
