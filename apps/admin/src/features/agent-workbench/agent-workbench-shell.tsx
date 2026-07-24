import type { AdminAgentCapabilityId } from "@adrian-zephyr-notes/contracts";
import type { Message } from "@ag-ui/client";
import { CopilotChatMessageView } from "@copilotkit/react-core/v2";
import {
  BookOpenText,
  Bot,
  ChevronDown,
  FileClock,
  Globe2,
  MessageSquareText,
  NotebookPen,
  Paperclip,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  Settings2,
  Square,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import { AgentReasoningMessage } from "./agent-reasoning-message";
import type { AgentLandingCapabilitySuggestion } from "./agent-workbench-types";

type AgentWorkbenchShellProps = {
  children?: ReactNode;
  errorMessage: string | null;
  isLoading: boolean;
  isSendingChat: boolean;
  landingSuggestions: AgentLandingCapabilitySuggestion[];
  messages: Message[];
  promptText: string;
  shouldShowLanding: boolean;
  onChangePromptText: (value: string) => void;
  onClearConversation: () => void;
  onStop: () => void;
  onSubmitPrompt: (input: string) => void;
};

function AgentWorkbenchShell({
  children,
  errorMessage,
  isLoading,
  isSendingChat,
  landingSuggestions,
  messages,
  promptText,
  shouldShowLanding,
  onChangePromptText,
  onClearConversation,
  onStop,
  onSubmitPrompt,
}: AgentWorkbenchShellProps) {
  return (
    <section
      aria-labelledby="agent-workbench-title"
      className="relative flex h-[calc(100dvh-1rem)] min-h-0 flex-col overflow-hidden sm:h-[calc(100dvh-1.5rem)] lg:h-[calc(100dvh-2rem)]"
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        <h2 className="sr-only" id="agent-workbench-title">
          Agent 工作台
        </h2>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Bot aria-hidden="true" className="size-4" />
          </span>
          <nav aria-label="面包屑" className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-muted-foreground">Agent</span>
            <span aria-hidden="true" className="text-border">
              /
            </span>
            <span aria-current="page" className="font-medium text-foreground">
              对话
            </span>
          </nav>
        </div>

        <Button
          aria-label="重置会话上下文"
          className="size-10 rounded-full"
          size="icon"
          title="重置会话上下文"
          type="button"
          variant="ghost"
          onClick={onClearConversation}
        >
          <RotateCcw aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <div
        aria-labelledby="agent-command-title"
        className="flex min-h-0 flex-1 flex-col"
        role="region"
      >
        <h3 className="sr-only" id="agent-command-title">
          Agent 对话框
        </h3>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 sm:px-6"
          aria-live="polite"
        >
          {shouldShowLanding ? (
            <AgentAssistantLanding
              isLoading={isLoading}
              suggestions={landingSuggestions}
              onSubmitPrompt={onSubmitPrompt}
            />
          ) : (
            <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-end gap-3 py-4">
              <CopilotChatMessageView
                className="grid gap-3"
                isRunning={isSendingChat}
                messages={messages}
                reasoningMessage={AgentReasoningMessage}
              />

              {errorMessage ? (
                <div
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </div>
              ) : null}

              {children}
            </div>
          )}
        </div>

        <AgentPromptDock
          isLoading={isLoading}
          isSendingChat={isSendingChat}
          promptText={promptText}
          onChangePromptText={onChangePromptText}
          onStop={onStop}
          onSubmitPrompt={onSubmitPrompt}
        />
      </div>
    </section>
  );
}

function AgentAssistantLanding({
  isLoading,
  suggestions,
  onSubmitPrompt,
}: {
  isLoading: boolean;
  suggestions: AgentLandingCapabilitySuggestion[];
  onSubmitPrompt: (input: string) => void;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col justify-center gap-8 py-8 sm:py-12">
      <div className="grid gap-4">
        <img
          alt="AZ Notes Agent 助手"
          className="size-28 rounded-[2rem] border border-primary/20 bg-background/80 object-cover shadow-sm sm:size-32"
          height={128}
          src="/agent-assistant-avatar.svg"
          width={128}
        />
        <div>
          <p className="text-4xl font-semibold tracking-normal text-foreground">下午好</p>
          <p className="mt-3 max-w-xl text-lg text-muted-foreground">有什么我可以帮你的吗？</p>
        </div>
      </div>

      <div className="grid max-w-3xl gap-3">
        {suggestions.map((suggestion) => (
          <LandingSuggestionButton
            key={suggestion.id}
            description={suggestion.description}
            disabled={isLoading && suggestion.id === "comments"}
            icon={getCapabilityIcon(suggestion.id)}
            title={suggestion.title}
            onClick={() => onSubmitPrompt(suggestion.prompt)}
          />
        ))}
      </div>
    </div>
  );
}

function getCapabilityIcon(id: AgentLandingCapabilitySuggestion["id"]) {
  const iconById = {
    articles: <NotebookPen aria-hidden="true" />,
    audit: <FileClock aria-hidden="true" />,
    comments: <MessageSquareText aria-hidden="true" />,
    guestbook: <BookOpenText aria-hidden="true" />,
    site: <Settings2 aria-hidden="true" />,
  } satisfies Record<AdminAgentCapabilityId, ReactNode>;

  return iconById[id];
}

function LandingSuggestionButton({
  description,
  disabled,
  icon,
  title,
  onClick,
}: {
  description: string;
  disabled?: boolean;
  icon: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex max-w-3xl items-center gap-4 rounded-full border border-border/50 bg-background/85 px-4 py-3 text-left shadow-sm transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-out-ui) hover:border-primary/35 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-foreground">{title}</span>
        <span className="mt-1 block truncate text-sm text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}

function AgentPromptDock({
  isSendingChat,
  isLoading,
  promptText,
  onChangePromptText,
  onStop,
  onSubmitPrompt,
}: {
  isSendingChat: boolean;
  isLoading: boolean;
  promptText: string;
  onChangePromptText: (value: string) => void;
  onStop: () => void;
  onSubmitPrompt: (input: string) => void;
}) {
  const [areShortcutsVisible, setAreShortcutsVisible] = useState(false);
  const shortcutActions = [
    {
      disabled: isLoading || isSendingChat,
      icon: <MessageSquareText aria-hidden="true" />,
      label: "评论",
      prompt: "分析今日评论",
    },
    {
      disabled: isSendingChat,
      icon: <NotebookPen aria-hidden="true" />,
      label: "文章",
      prompt: "进入文章工作台",
    },
    {
      disabled: isSendingChat,
      icon: <BookOpenText aria-hidden="true" />,
      label: "留言",
      prompt: "处理留言板",
    },
    {
      disabled: isSendingChat,
      icon: <Settings2 aria-hidden="true" />,
      label: "站点",
      prompt: "巡检站点配置",
    },
    {
      disabled: isSendingChat,
      icon: <FileClock aria-hidden="true" />,
      label: "审计",
      prompt: "查看审计日志",
    },
    {
      disabled: isLoading || isSendingChat,
      icon: <RefreshCw aria-hidden="true" className={cn(isLoading && "animate-spin")} />,
      label: "刷新",
      prompt: "刷新状态",
    },
  ];

  return (
    <form
      className="relative z-10 shrink-0 bg-linear-to-b from-transparent via-muted/30 to-muted/55 px-4 pt-3 pb-4 sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitPrompt(promptText);
      }}
    >
      <div className="mx-auto grid max-w-4xl gap-2">
        {areShortcutsVisible ? (
          <div
            aria-label="Agent 能力快捷项"
            className="grid grid-cols-3 gap-2 rounded-xl border border-border/45 bg-background/55 p-2 shadow-xs sm:grid-cols-6"
          >
            {shortcutActions.map((action) => (
              <PromptShortcutButton
                key={action.prompt}
                disabled={action.disabled}
                icon={action.icon}
                label={action.label}
                onClick={() => onSubmitPrompt(action.prompt)}
              />
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl border border-primary/35 bg-background/94 p-2 shadow-[0_14px_32px_color-mix(in_oklch,var(--primary)_12%,transparent)] transition-[border-color,box-shadow] duration-200 ease-(--ease-out-ui) focus-within:border-primary/65 focus-within:shadow-[0_16px_36px_color-mix(in_oklch,var(--primary)_20%,transparent)] motion-reduce:transition-none">
          <Textarea
            aria-label="Agent 指令"
            className="max-h-48 min-h-24 resize-y border-0 bg-transparent px-3 py-2 text-base leading-7 shadow-none focus-visible:bg-transparent focus-visible:ring-0"
            disabled={isSendingChat}
            id="agent-workbench-prompt"
            name="agent-workbench-prompt"
            placeholder="描述你想完成的工作，Agent 会结合当前工作台上下文协助处理…"
            rows={3}
            value={promptText}
            onChange={(event) => onChangePromptText(event.target.value)}
          />

          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border/45 px-1 pt-2">
            <div className="flex min-w-0 items-center gap-1">
              <Button
                aria-label={areShortcutsVisible ? "收起能力快捷项" : "打开能力快捷项"}
                aria-pressed={areShortcutsVisible}
                className="size-9 rounded-lg text-primary"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setAreShortcutsVisible((isVisible) => !isVisible)}
              >
                <Plus aria-hidden="true" className="size-5" />
              </Button>
              <span aria-hidden="true" className="h-5 w-px bg-border/55" />
              <Button
                aria-label="添加附件（暂未开放）"
                className="size-9 rounded-lg"
                disabled
                size="icon"
                title="附件功能暂未开放"
                type="button"
                variant="ghost"
              >
                <Paperclip aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label="联网能力（暂未开放）"
                className="size-9 rounded-lg"
                disabled
                size="icon"
                title="联网能力暂未开放"
                type="button"
                variant="ghost"
              >
                <Globe2 aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label="选择 Agent 工作模式"
                className="h-9 gap-1 rounded-lg px-2 text-muted-foreground"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setAreShortcutsVisible((isVisible) => !isVisible)}
              >
                <span>能力</span>
                <ChevronDown aria-hidden="true" className="size-3.5" />
              </Button>
            </div>

            <Button
              aria-label={isSendingChat ? "停止生成" : "发送"}
              className="size-10 rounded-full shadow-[0_6px_16px_color-mix(in_oklch,var(--primary)_35%,transparent)]"
              size="icon"
              type={isSendingChat ? "button" : "submit"}
              onClick={isSendingChat ? onStop : undefined}
            >
              {isSendingChat ? (
                <Square aria-hidden="true" className="size-3.5 fill-current" />
              ) : (
                <Send aria-hidden="true" className="size-4.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function PromptShortcutButton({
  disabled,
  icon,
  label,
  onClick,
}: {
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="grid min-h-16 place-items-center gap-1 rounded-lg p-2 text-xs font-medium text-foreground transition-[background-color,color] duration-150 ease-(--ease-out-ui) hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-4">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

export { AgentWorkbenchShell };
