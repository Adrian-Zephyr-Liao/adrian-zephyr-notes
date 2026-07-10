import type {
  AdminAgentConversationMessageResponse,
  AdminAgentHomeResponse,
  AdminAgentTaskSummaryResponse,
  AdminAgentTaskStatus,
} from "@adrian-zephyr-notes/contracts";
import { useAgentContext } from "@copilotkit/react-core/v2";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentWorkbenchClient } from "./agent-api-client";
import { useAgentWorkbenchClient } from "./agent-api-client";
import { createAgentContextRegistry } from "./agent-context-registry";
import { AgentHumanInLoopTools } from "./agent-human-in-the-loop-tools";
import { AgentWorkbenchShell } from "./agent-workbench-shell";
import type { AgentConversationItem, AgentConversationMessage } from "./agent-workbench-types";

const agentConversationStorageKey = "az-notes-agent-conversation-id";
const agentTaskContextPageSize = 8;
const agentTaskChildContextPageSize = 8;
const agentTaskContextStatuses = [
  "WAITING_FOR_APPROVAL",
  "RUNNING",
  "FAILED",
] satisfies AdminAgentTaskStatus[];

function AgentWorkbenchPage() {
  const [home, setHome] = useState<AdminAgentHomeResponse | null>(null);
  const [conversationItems, setConversationItems] = useState<AgentConversationItem[]>([]);
  const [conversationId, setConversationId] = useState(() => getOrCreateAgentConversationId());
  const [agentTasks, setAgentTasks] = useState<AdminAgentTaskSummaryResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const conversationItemsRef = useRef<AgentConversationItem[]>([]);
  const contextRegistry = useMemo(
    () => createAgentContextRegistry(home, agentTasks),
    [home, agentTasks],
  );
  const agentClient = useAgentWorkbenchClient();

  const loadHome = useCallback(
    async (options: { showLoading?: boolean } = {}) => {
      const shouldShowLoading = options.showLoading ?? true;

      if (shouldShowLoading) {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const nextHome = await agentClient.loadHome();

        setHome(nextHome);
        try {
          const taskContext = await loadAgentTaskContext(agentClient);

          setAgentTasks(taskContext.tasks);
        } catch {
          setAgentTasks([]);
        }
      } catch {
        setErrorMessage("Agent 工作台加载失败，请检查服务端或管理员登录状态。");
      } finally {
        if (shouldShowLoading) {
          setIsLoading(false);
        }
      }
    },
    [agentClient],
  );

  async function sendChatMessage(input: string) {
    let assistantMessageId: string | null = null;
    let activeRemoteTextMessageId: string | null = null;
    let shouldStartNewAssistantMessage = false;
    let streamedText = "";
    const recentMessages = getConversationMessages(conversationItemsRef.current);

    appendUserMessage(input);
    setErrorMessage(null);
    setIsSendingChat(true);

    try {
      await agentClient.streamChatMessage(
        {
          conversationId,
          message: input,
          recentMessages,
        },
        {
          onEvent(event) {
            if (event.type === "textDelta") {
              if (
                assistantMessageId === null ||
                activeRemoteTextMessageId !== event.messageId ||
                shouldStartNewAssistantMessage
              ) {
                assistantMessageId = appendAssistantMessage("");
                activeRemoteTextMessageId = event.messageId;
                shouldStartNewAssistantMessage = false;
                streamedText = "";
              }

              streamedText += event.delta;
              replaceConversationMessage(assistantMessageId, streamedText);
              return;
            }

            if (event.type === "textMessage") {
              if (assistantMessageId === null || shouldStartNewAssistantMessage) {
                assistantMessageId = appendAssistantMessage("");
                activeRemoteTextMessageId = null;
                shouldStartNewAssistantMessage = false;
              }

              streamedText = event.message.content;
              replaceConversationMessage(assistantMessageId, event.message.content);
              return;
            }

            if (event.type === "toolCallStart") {
              appendToolCallItem(event.toolCallId);
              if (assistantMessageId !== null && streamedText.trim().length > 0) {
                shouldStartNewAssistantMessage = true;
              }
              return;
            }

            if (event.type === "toolCallEnd") {
              ensureToolCallItem(event.toolCallId);
              if (assistantMessageId !== null && streamedText.trim().length > 0) {
                shouldStartNewAssistantMessage = true;
              }
            }
          },
        },
      );
    } catch (error) {
      if (assistantMessageId === null || shouldStartNewAssistantMessage) {
        assistantMessageId = appendAssistantMessage("");
      }
      replaceConversationMessage(assistantMessageId, toAgentChatFailureMessage(error));
    } finally {
      setIsSendingChat(false);
      void loadHome({ showLoading: false });
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

  function appendUserMessage(userText: string) {
    appendConversationItem({
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      text: userText,
    });
  }

  function appendAssistantMessage(assistantText: string) {
    const assistantMessageId = `assistant-${crypto.randomUUID()}`;

    appendConversationItem({
      id: assistantMessageId,
      role: "assistant",
      text: assistantText,
    });

    return assistantMessageId;
  }

  function appendToolCallItem(toolCallId: string) {
    updateConversationItems((current) =>
      current.some((item) => "toolCallId" in item && item.toolCallId === toolCallId)
        ? current
        : [...current, { id: `tool-call-${toolCallId}`, toolCallId, type: "toolCall" }],
    );
  }

  function ensureToolCallItem(toolCallId: string) {
    appendToolCallItem(toolCallId);
  }

  function appendConversationItem(item: AgentConversationItem) {
    updateConversationItems((current) => [...current, item]);
  }

  function replaceConversationMessage(id: string, text: string) {
    updateConversationItems((current) =>
      current.map((item) => (item.id === id && !("toolCallId" in item) ? { ...item, text } : item)),
    );
  }

  function clearConversation() {
    setConversationId(resetAgentConversationId());
    updateConversationItems(() => []);
    setErrorMessage(null);
  }

  function updateConversationItems(
    updater: (current: AgentConversationItem[]) => AgentConversationItem[],
  ) {
    const nextItems = updater(conversationItemsRef.current);

    conversationItemsRef.current = nextItems;
    setConversationItems(nextItems);
  }

  useEffect(() => {
    void loadHome();
  }, [loadHome]);

  useEffect(() => {
    let isActive = true;

    async function loadPersistedConversation() {
      try {
        const response = await agentClient.listConversationMessages(conversationId);

        if (!isActive || conversationItemsRef.current.length > 0) {
          return;
        }

        const items = response.data.map(
          (message: AdminAgentConversationMessageResponse): AgentConversationMessage => ({
            id: `persisted-${message.id}`,
            role: message.role,
            text: message.content,
          }),
        );

        updateConversationItems(() => items);
      } catch {
        // Conversation recovery should never block the workbench from opening.
      }
    }

    void loadPersistedConversation();

    return () => {
      isActive = false;
    };
  }, [agentClient, conversationId]);

  const hasConversation = conversationItems.length > 0 || Boolean(errorMessage);

  useEffect(() => {
    if (!hasConversation) {
      return;
    }

    conversationEndRef.current?.scrollIntoView({
      block: "end",
    });
  }, [conversationItems.length, errorMessage, hasConversation, home?.lastUpdatedAt]);

  return (
    <>
      {contextRegistry.entries.map((entry) => (
        <AgentWorkbenchContextEntry key={entry.id} entry={entry} />
      ))}
      <AgentHumanInLoopTools
        agentTasks={agentTasks}
        home={home}
        onOperationApplied={() => loadHome({ showLoading: false })}
      />
      <AgentWorkbenchShell
        conversationItems={conversationItems}
        errorMessage={errorMessage}
        isLoading={isLoading}
        isSendingChat={isSendingChat}
        landingSuggestions={contextRegistry.suggestions}
        promptText={promptText}
        shouldShowLanding={!hasConversation}
        onChangePromptText={setPromptText}
        onClearConversation={clearConversation}
        onOpenWorkbenchMenu={openWorkbenchMenu}
        onSubmitPrompt={submitPrompt}
      >
        <div ref={conversationEndRef} aria-hidden="true" className="h-px" />
      </AgentWorkbenchShell>
    </>
  );
}

type AgentTaskContextResult = {
  tasks: AdminAgentTaskSummaryResponse[];
};

async function loadAgentTaskContext(
  agentClient: AgentWorkbenchClient,
): Promise<AgentTaskContextResult> {
  const taskPages = await Promise.all([
    agentClient.listAgentTasks({
      page: 1,
      pageSize: agentTaskContextPageSize,
      rootOnly: true,
      taskName: "ALL",
    }),
    ...agentTaskContextStatuses.map(async (status) => {
      try {
        return await agentClient.listAgentTasks({
          page: 1,
          pageSize: agentTaskContextPageSize,
          status,
          taskName: "ALL",
        });
      } catch {
        return null;
      }
    }),
  ]);
  const taskSeeds = dedupeAgentTasks(taskPages.flatMap((page) => page?.data ?? []));
  const childTaskPages = await Promise.all(
    taskSeeds
      .filter((task) => task.parentTaskId === null)
      .map(async (task) => {
        try {
          return await agentClient.listAgentTasks({
            page: 1,
            pageSize: agentTaskChildContextPageSize,
            parentTaskId: task.id,
            relation: "child",
            taskName: "ALL",
          });
        } catch {
          return null;
        }
      }),
  );
  const childTasks = childTaskPages.flatMap((page) => page?.data ?? []);
  const tasks = dedupeAgentTasks([...taskSeeds, ...childTasks]);

  return {
    tasks,
  };
}

function dedupeAgentTasks(tasks: AdminAgentTaskSummaryResponse[]) {
  const taskById = new Map<string, AdminAgentTaskSummaryResponse>();

  for (const task of tasks) {
    taskById.set(task.id, task);
  }

  return [...taskById.values()];
}

function getConversationMessages(items: AgentConversationItem[]): AgentConversationMessage[] {
  return items.filter((item): item is AgentConversationMessage => !("toolCallId" in item));
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
