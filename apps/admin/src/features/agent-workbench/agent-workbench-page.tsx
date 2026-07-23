import type { AdminAgentHomeResponse } from "@adrian-zephyr-notes/contracts";
import type { Message } from "@ag-ui/client";
import {
  UseAgentUpdate,
  useAgent,
  useAgentContext,
  useCopilotKit,
} from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAgentWorkbenchClient } from "./agent-api-client";
import { createAgentContextRegistry } from "./agent-context-registry";
import { AgentWorkbenchShell } from "./agent-workbench-shell";
import { adminAgentId } from "./agent-tool-contracts";

const agentConversationStorageKey = "az-notes-agent-conversation-id";
const agentWorkbenchUpdates: UseAgentUpdate[] = [
  UseAgentUpdate.OnMessagesChanged,
  UseAgentUpdate.OnRunStatusChanged,
];

function AgentWorkbenchPage() {
  const [home, setHome] = useState<AdminAgentHomeResponse | null>(null);
  const [conversationId, setConversationId] = useState(() => getOrCreateAgentConversationId());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const homeLoadPromiseRef = useRef<Promise<void> | null>(null);
  const { agent } = useAgent({
    agentId: adminAgentId,
    throttleMs: 40,
    updates: agentWorkbenchUpdates,
  });
  const wasAgentRunningRef = useRef(agent.isRunning);
  const { copilotkit } = useCopilotKit();
  const contextRegistry = useMemo(() => createAgentContextRegistry(home), [home]);
  const agentClient = useAgentWorkbenchClient();

  const loadHome = useCallback(
    (options: { showLoading?: boolean } = {}) => {
      if (homeLoadPromiseRef.current) {
        return homeLoadPromiseRef.current;
      }

      const shouldShowLoading = options.showLoading ?? true;
      const request = (async () => {
        if (shouldShowLoading) {
          setIsLoading(true);
        }
        setErrorMessage(null);

        try {
          const nextHome = await agentClient.loadHome();

          setHome(nextHome);
        } catch {
          setErrorMessage("Agent 工作台加载失败，请检查服务端或管理员登录状态。");
        } finally {
          if (shouldShowLoading) {
            setIsLoading(false);
          }
        }
      })();

      homeLoadPromiseRef.current = request;
      void request.finally(() => {
        if (homeLoadPromiseRef.current === request) {
          homeLoadPromiseRef.current = null;
        }
      });

      return request;
    },
    [agentClient],
  );

  const refreshHomeAfterOperation = useCallback(async () => {
    const currentLoad = homeLoadPromiseRef.current;

    if (currentLoad) {
      await currentLoad;
    }

    await loadHome({ showLoading: false });
  }, [loadHome]);

  async function sendChatMessage(input: string) {
    agent.addMessage({
      content: input,
      id: `user-${crypto.randomUUID()}`,
      role: "user",
    });
    setErrorMessage(null);

    try {
      await copilotkit.runAgent({
        agent,
        forwardedProps: {
          ...copilotkit.properties,
          conversationId,
        },
        runId: `admin-agent-run-${crypto.randomUUID()}`,
      });
    } catch (error) {
      setErrorMessage(toAgentChatFailureMessage(error));
    }
  }

  function openWorkbenchMenu() {
    void sendChatMessage("打开工作台菜单");
  }

  function submitPrompt(input: string) {
    const trimmedInput = input.trim();

    if (trimmedInput.length === 0) {
      setPromptText("");
      return;
    }

    void sendChatMessage(trimmedInput);
    setPromptText("");
  }

  function clearConversation() {
    agent.abortRun();
    agent.setMessages([]);
    setConversationId(resetAgentConversationId());
    setErrorMessage(null);
  }

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    const wasRunning = wasAgentRunningRef.current;

    wasAgentRunningRef.current = agent.isRunning;

    if (!wasRunning || agent.isRunning) {
      return;
    }

    void refreshHomeAfterOperation();
  }, [agent.isRunning, refreshHomeAfterOperation]);

  useEffect(() => {
    copilotkit.setProperties({
      ...copilotkit.properties,
      conversationId,
    });
  }, [conversationId, copilotkit]);

  useEffect(() => {
    let isActive = true;

    async function loadPersistedConversation() {
      try {
        const response = await agentClient.listConversationMessages(conversationId);

        if (!isActive || agent.messages.length > 0) {
          return;
        }

        const messages: Message[] = response.data;

        agent.setMessages(messages);
      } catch {
        // Conversation recovery should never block the workbench from opening.
      }
    }

    void loadPersistedConversation();

    return () => {
      isActive = false;
    };
  }, [agent, agentClient, conversationId]);

  const hasConversation = agent.messages.length > 0 || Boolean(errorMessage);

  useEffect(() => {
    if (!hasConversation) {
      return;
    }

    conversationEndRef.current?.scrollIntoView({
      block: "end",
    });
  }, [agent.isRunning, agent.messages.length, errorMessage, hasConversation, home?.lastUpdatedAt]);

  return (
    <>
      {contextRegistry.entries.map((entry) => (
        <AgentWorkbenchContextEntry key={entry.id} entry={entry} />
      ))}
      <AgentWorkbenchShell
        errorMessage={errorMessage}
        isLoading={isLoading}
        isSendingChat={agent.isRunning}
        landingSuggestions={contextRegistry.suggestions}
        messages={agent.messages}
        promptText={promptText}
        shouldShowLanding={!hasConversation}
        onChangePromptText={setPromptText}
        onClearConversation={clearConversation}
        onOpenWorkbenchMenu={openWorkbenchMenu}
        onStop={() => agent.abortRun()}
        onSubmitPrompt={submitPrompt}
      >
        <div ref={conversationEndRef} aria-hidden="true" className="h-px" />
      </AgentWorkbenchShell>
    </>
  );
}

function getOrCreateAgentConversationId() {
  const existing = readAgentConversationId();

  if (existing) {
    return existing;
  }

  return resetAgentConversationId();
}

function resetAgentConversationId() {
  const nextId = `agent-conversation-${crypto.randomUUID()}`;

  try {
    window.localStorage.setItem(agentConversationStorageKey, nextId);
  } catch {
    // Local storage can be disabled; the in-memory id still works for this session.
  }

  return nextId;
}

function readAgentConversationId() {
  try {
    return window.localStorage.getItem(agentConversationStorageKey)?.trim() || null;
  } catch {
    return null;
  }
}

function toAgentChatFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("aborted due to timeout") || message.toLowerCase().includes("timeout")) {
    return "LLM 请求超时，已停止等待。请稍后重试，或调高 LLM_TIMEOUT_MS。";
  }

  if (message.includes("new_sensitive") || message.includes("unprocessable_entity_error")) {
    return "LLM 拒绝了本次输入。请清空对话后重试，或减少历史上下文里的敏感内容。";
  }

  if (message.includes("fetch failed") || message.includes("ECONNRESET")) {
    return "LLM 网络请求失败，请检查本机网络或 LLM_BASE_URL 是否可访问。";
  }

  if (message.includes("LLM_API_KEY") || message.includes("LLM_MODEL")) {
    return "LLM 配置缺失，请检查 LLM_API_KEY 和 LLM_MODEL。";
  }

  return "LLM 对话暂时不可用，请检查服务端日志或 LLM 配置后重试。";
}

function AgentWorkbenchContextEntry({
  entry,
}: {
  entry: ReturnType<typeof createAgentContextRegistry>["entries"][number];
}) {
  useAgentContext({
    description: [entry.id, entry.title, entry.description].join("\n"),
    value: entry.value,
  });

  return null;
}

export { AgentWorkbenchPage };
