import {
  CopilotChatReasoningMessage,
  type CopilotChatReasoningMessageProps,
} from "@copilotkit/react-core/v2";
import { ChevronDown, LoaderCircle } from "lucide-react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../lib/utils";

type AgentReasoningMessageValue = CopilotChatReasoningMessageProps["message"];
type AgentChatMessage = NonNullable<CopilotChatReasoningMessageProps["messages"]>[number];
type AgentReasoningRuntime = {
  durations: Record<string, number>;
  isRunning: boolean | null;
  messages: AgentChatMessage[] | null;
};

type AgentReasoningGroup = {
  activeReasoningMessageId: string | null;
  hasFinalAssistantResponse: boolean;
  isFirstMessage: boolean;
  isLatestTurn: boolean;
  messages: AgentReasoningMessageValue[];
};

const AgentReasoningRuntimeContext = createContext<AgentReasoningRuntime>({
  durations: {},
  isRunning: null,
  messages: null,
});

function AgentReasoningDurationProvider({
  children,
  durations,
  isRunning,
  messages,
}: {
  children: ReactNode;
  durations: Record<string, number>;
  isRunning?: boolean;
  messages?: AgentChatMessage[];
}) {
  const runtime = useMemo<AgentReasoningRuntime>(
    () => ({
      durations,
      isRunning: isRunning ?? null,
      messages: messages ?? null,
    }),
    [durations, isRunning, messages],
  );

  return (
    <AgentReasoningRuntimeContext.Provider value={runtime}>
      {children}
    </AgentReasoningRuntimeContext.Provider>
  );
}

function formatReasoningDuration(seconds: number) {
  if (seconds < 60) {
    return `${seconds}秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
}

function AgentReasoningMessageView({
  className,
  isRunning = false,
  message,
  messages = [],
}: CopilotChatReasoningMessageProps) {
  const runtime = useContext(AgentReasoningRuntimeContext);
  const currentMessages = runtime.messages ?? messages;
  const currentIsRunning = runtime.isRunning ?? isRunning;
  const group = resolveReasoningGroup(currentMessages, message);

  if (!group.isFirstMessage) {
    return <></>;
  }

  return (
    <AgentReasoningProcessMessage
      className={className}
      group={group}
      isRunning={currentIsRunning}
      message={message}
    />
  );
}

function AgentReasoningProcessMessage({
  className,
  group,
  isRunning,
  message,
}: {
  className?: string;
  group: AgentReasoningGroup;
  isRunning: boolean;
  message: AgentReasoningMessageValue;
}) {
  const contentId = useId();
  const { durations: reasoningDurations } = useContext(AgentReasoningRuntimeContext);
  const isActive = isRunning && group.isLatestTurn && !group.hasFinalAssistantResponse;
  const hasContent = group.messages.some((item) => Boolean(item.content.trim()));
  const persistedElapsedSeconds = toReasoningGroupDurationSeconds(
    group.messages,
    reasoningDurations,
  );
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(persistedElapsedSeconds);
  const contentViewportRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef<number | null>(null);
  const reasoningContentLength = group.messages.reduce(
    (total, reasoningMessage) => total + reasoningMessage.content.length,
    0,
  );

  useEffect(() => {
    if (!isActive) {
      if (startedAtRef.current !== null) {
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        startedAtRef.current = null;
        setElapsedSeconds(durationSeconds);
      } else {
        setElapsedSeconds(persistedElapsedSeconds);
      }

      return;
    }

    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);
    }

    const updateElapsed = () => {
      if (startedAtRef.current !== null) {
        setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    };
    const timer = window.setInterval(updateElapsed, 1000);

    return () => window.clearInterval(timer);
  }, [isActive, persistedElapsedSeconds]);

  useEffect(() => {
    if (isActive) {
      setIsDetailsExpanded(false);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive || isDetailsExpanded) {
      return;
    }

    const viewport = contentViewportRef.current;

    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [isActive, isDetailsExpanded, reasoningContentLength]);

  const duration = elapsedSeconds === null ? null : formatReasoningDuration(elapsedSeconds);
  const stepCount = group.messages.length;
  const stepCountLabel = stepCount > 1 ? `，${stepCount}个步骤` : "";
  const statusLabel = isActive
    ? `正在执行（已用时${duration ?? "0秒"}${stepCountLabel}）`
    : duration
      ? `执行完成（用时${duration}${stepCountLabel}）`
      : stepCount > 1
        ? `执行完成（${stepCount}个步骤）`
        : "执行完成";

  return (
    <div
      className={cn(
        "my-2 w-full max-w-full overflow-hidden rounded-lg border border-border/60 bg-background/60",
        className,
      )}
      data-message-id={message.id}
      data-reasoning-step-count={stepCount}
    >
      <button
        aria-controls={contentId}
        aria-expanded={isDetailsExpanded}
        aria-label={`${statusLabel}，${isDetailsExpanded ? "收起执行明细" : "展开执行明细"}`}
        disabled={!hasContent}
        className="group flex min-h-14 w-full items-center gap-2.5 px-4 text-left text-base text-muted-foreground transition-colors duration-150 ease-(--ease-out-ui) hover:bg-muted/35 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:cursor-default motion-reduce:transition-none sm:px-5"
        type="button"
        onClick={() => {
          setIsDetailsExpanded((current) => !current);
        }}
      >
        {isActive ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
          />
        ) : null}
        <span aria-live="polite" className="font-semibold text-foreground">
          {isActive ? "正在执行" : "执行完成"}
        </span>
        {duration ? (
          <span aria-hidden="true" className="text-muted-foreground/60">
            （{isActive ? "已用时" : "用时"}
            {duration}）
          </span>
        ) : null}
        {stepCount > 1 ? (
          <span aria-hidden="true" className="text-sm text-muted-foreground/70">
            · {stepCount} 个步骤
          </span>
        ) : null}
        <span className="flex-1" />
        <span className="text-xs font-medium text-muted-foreground/70">
          {isDetailsExpanded ? "收起明细" : "展开明细"}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-5 shrink-0 transition-transform duration-200 ease-(--ease-out-ui) motion-reduce:transition-none",
            isDetailsExpanded && "rotate-180",
          )}
        />
      </button>

      <div
        aria-label={isActive ? "正在执行的过程明细" : "已完成的执行过程明细"}
        className={cn(
          "min-h-0",
          !isDetailsExpanded &&
            "max-h-28 scrollbar-gutter-stable overflow-y-auto overscroll-contain",
        )}
        data-reasoning-content-viewport=""
        id={contentId}
        ref={contentViewportRef}
        role="region"
        tabIndex={0}
      >
        {stepCount === 1 ? (
          <CopilotChatReasoningMessage.Content
            className="border-t border-border/60 px-5 py-4 text-sm leading-7 text-muted-foreground sm:px-6"
            hasContent={hasContent}
            isStreaming={isActive && group.activeReasoningMessageId === message.id}
          >
            {group.messages[0]?.content ?? message.content}
          </CopilotChatReasoningMessage.Content>
        ) : (
          <ol className="divide-y divide-border/55 border-t border-border/60">
            {group.messages.map((step, index) => (
              <li className="px-5 py-4 sm:px-6" key={step.id}>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground/70">
                  <span
                    aria-hidden="true"
                    className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] text-muted-foreground tabular-nums"
                  >
                    {index + 1}
                  </span>
                  <span>步骤 {index + 1}</span>
                </div>
                <CopilotChatReasoningMessage.Content
                  className="text-sm leading-7 text-muted-foreground"
                  hasContent={Boolean(step.content.trim())}
                  isStreaming={isActive && group.activeReasoningMessageId === step.id}
                >
                  {step.content}
                </CopilotChatReasoningMessage.Content>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function resolveReasoningGroup(
  messages: AgentChatMessage[],
  message: AgentReasoningMessageValue,
): AgentReasoningGroup {
  const messageIndex = messages.findIndex((item) => item.id === message.id);

  if (messageIndex < 0) {
    return {
      activeReasoningMessageId: message.id,
      hasFinalAssistantResponse: false,
      isFirstMessage: true,
      isLatestTurn: true,
      messages: [localizeReasoningMessage(message, [])],
    };
  }

  let turnStartIndex = 0;
  let turnEndIndex = messages.length;

  for (let index = messageIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      turnStartIndex = index + 1;
      break;
    }
  }

  for (let index = messageIndex + 1; index < messages.length; index += 1) {
    if (messages[index]?.role === "user") {
      turnEndIndex = index;
      break;
    }
  }

  const turnMessages = messages.slice(turnStartIndex, turnEndIndex);
  const reasoningMessages = turnMessages.filter(isReasoningMessage);
  const localizedReasoningMessages = reasoningMessages.map((reasoningMessage, index) => {
    const reasoningIndex = turnMessages.findIndex(
      (turnMessage) => turnMessage.id === reasoningMessage.id,
    );
    const nextReasoningMessageId = reasoningMessages[index + 1]?.id;
    const nextReasoningIndex = nextReasoningMessageId
      ? turnMessages.findIndex((turnMessage) => turnMessage.id === nextReasoningMessageId)
      : turnMessages.length;

    return localizeReasoningMessage(
      reasoningMessage,
      turnMessages.slice(reasoningIndex + 1, nextReasoningIndex),
    );
  });
  const lastReasoningMessageId = reasoningMessages.at(-1)?.id;
  const lastReasoningIndex = turnMessages.findIndex(
    (turnMessage) => turnMessage.id === lastReasoningMessageId,
  );
  const lastMessage = messages.at(-1);

  return {
    activeReasoningMessageId: isReasoningMessage(lastMessage) ? lastMessage.id : null,
    hasFinalAssistantResponse: turnMessages
      .slice(lastReasoningIndex + 1)
      .some(isFinalAssistantResponse),
    isFirstMessage: reasoningMessages[0]?.id === message.id,
    isLatestTurn: turnEndIndex === messages.length,
    messages:
      localizedReasoningMessages.length > 0
        ? localizedReasoningMessages
        : [localizeReasoningMessage(message, [])],
  };
}

function localizeReasoningMessage(
  message: AgentReasoningMessageValue,
  followingMessages: AgentChatMessage[],
): AgentReasoningMessageValue {
  if (isChineseExecutionContent(message.content)) {
    return message;
  }

  const toolNames = followingMessages.flatMap((followingMessage) =>
    followingMessage.role === "assistant"
      ? (followingMessage.toolCalls ?? []).map((toolCall) => toolCall.function.name)
      : [],
  );
  const uniqueToolNames = [...new Set(toolNames)];
  const localizedContent =
    uniqueToolNames.length > 0
      ? uniqueToolNames.map(toToolExecutionSummary).join("\n\n")
      : followingMessages.some(isFinalAssistantResponse)
        ? "正在整理执行结果并生成回复。"
        : "正在分析请求并规划下一步操作。";

  return {
    ...message,
    content: localizedContent,
  };
}

function isChineseExecutionContent(content: string) {
  const hanCharacterCount = content.match(/\p{Script=Han}/gu)?.length ?? 0;
  const hasEnglishSentence = /\b[A-Za-z]{2,}(?:[\s,.;:'"!?()[\]-]+[A-Za-z]{2,}){2,}\b/.test(
    content,
  );

  return hanCharacterCount >= 4 && !hasEnglishSentence;
}

function toToolExecutionSummary(toolName: string) {
  switch (toolName) {
    case "search_comments":
      return "正在筛选符合条件的评论。";
    case "analyze_comments":
      return "正在分析评论风险并生成治理建议。";
    case "hide_comments":
      return "正在隐藏已确认的评论。";
    case "restore_comments":
      return "正在恢复已确认的评论。";
    default:
      return `正在调用 ${toolName} 执行相关操作。`;
  }
}

function isReasoningMessage(
  message: AgentChatMessage | undefined,
): message is AgentReasoningMessageValue {
  return message?.role === "reasoning";
}

function isFinalAssistantResponse(message: AgentChatMessage | undefined) {
  return message?.role === "assistant" && !message.toolCalls?.length;
}

function toReasoningGroupDurationSeconds(
  messages: AgentReasoningMessageValue[],
  durations: Record<string, number>,
) {
  let hasDuration = false;
  let durationMs = 0;

  for (const message of messages) {
    const messageDuration = durations[message.id];

    if (
      typeof messageDuration !== "number" ||
      !Number.isFinite(messageDuration) ||
      messageDuration < 0
    ) {
      continue;
    }

    hasDuration = true;
    durationMs += messageDuration;
  }

  if (!hasDuration) {
    return null;
  }

  return Math.max(1, Math.round(durationMs / 1000));
}

const AgentReasoningMessage = Object.assign(AgentReasoningMessageView, {
  Content: CopilotChatReasoningMessage.Content,
  Header: CopilotChatReasoningMessage.Header,
  Toggle: CopilotChatReasoningMessage.Toggle,
});

export { AgentReasoningDurationProvider, AgentReasoningMessage };
