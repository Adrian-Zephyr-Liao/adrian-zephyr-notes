import type { AdminAgentCapabilityId } from "@adrian-zephyr-notes/contracts";
import { MarkdownPreview } from "@adrian-zephyr-notes/markdown";
import {
  BookOpenText,
  FileClock,
  MessageSquareText,
  NotebookPen,
  PanelLeft,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "../../components/ui/button";
import { Textarea } from "../../components/ui/textarea";
import { cn } from "../../lib/utils";
import { AgentToolCallMessage } from "./agent-tool-call-messages";
import type {
  AgentConversationItem,
  AgentConversationMessage,
  AgentLandingCapabilitySuggestion,
} from "./agent-workbench-types";

type AgentWorkbenchShellProps = {
  children?: ReactNode;
  conversationItems: AgentConversationItem[];
  errorMessage: string | null;
  isLoading: boolean;
  isSendingChat: boolean;
  landingSuggestions: AgentLandingCapabilitySuggestion[];
  promptText: string;
  shouldShowLanding: boolean;
  onChangePromptText: (value: string) => void;
  onClearConversation: () => void;
  onOpenWorkbenchMenu: () => void;
  onSubmitPrompt: (input: string) => void;
};

function AgentWorkbenchShell({
  children,
  conversationItems,
  errorMessage,
  isLoading,
  isSendingChat,
  landingSuggestions,
  promptText,
  shouldShowLanding,
  onChangePromptText,
  onClearConversation,
  onOpenWorkbenchMenu,
  onSubmitPrompt,
}: AgentWorkbenchShellProps) {
  return (
    <section
      aria-labelledby="agent-workbench-title"
      className="relative flex h-[calc(100dvh-1rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/35 shadow-(--shadow-glass) backdrop-blur-xl sm:h-[calc(100dvh-1.5rem)] lg:h-[calc(100dvh-2rem)]"
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 px-4 sm:px-6">
        <h2 className="sr-only" id="agent-workbench-title">
          Agent 工作台
        </h2>
        <Button
          aria-label="打开工作台菜单"
          className="relative size-10 rounded-full"
          size="icon"
          type="button"
          variant="ghost"
          onClick={onOpenWorkbenchMenu}
        >
          <PanelLeft aria-hidden="true" className="size-5" />
        </Button>

        <div aria-hidden="true" className="min-w-10 flex-1" />

        <div className="flex items-center gap-1">
          <Button
            aria-label="刷新状态"
            className="size-10 rounded-full"
            disabled={isLoading}
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => onSubmitPrompt("刷新状态")}
          >
            <RefreshCw aria-hidden="true" className={cn("size-5", isLoading && "animate-spin")} />
          </Button>
          <Button
            aria-label="清空对话"
            className="size-10 rounded-full"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClearConversation}
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
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
              {conversationItems.map((item) => (
                <ConversationItemView key={item.id} item={item} />
              ))}

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
          onSubmitPrompt={onSubmitPrompt}
        />
      </div>
    </section>
  );
}

function ConversationItemView({ item }: { item: AgentConversationItem }) {
  if ("toolCallId" in item) {
    return <AgentToolCallMessage toolCallId={item.toolCallId} />;
  }

  return <ConversationTextMessage message={item} />;
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
  onSubmitPrompt,
}: {
  isSendingChat: boolean;
  isLoading: boolean;
  promptText: string;
  onChangePromptText: (value: string) => void;
  onSubmitPrompt: (input: string) => void;
}) {
  const [areShortcutsVisible, setAreShortcutsVisible] = useState(true);
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
      className="relative z-10 shrink-0 border-t border-border/50 bg-muted/35 px-4 pt-3 pb-4 backdrop-blur-xl sm:px-6"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmitPrompt(promptText);
      }}
    >
      <div className="mx-auto grid max-w-4xl gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border/55 bg-background/90 p-2 shadow-sm">
          <Button
            aria-label={areShortcutsVisible ? "收起能力快捷项" : "打开能力快捷项"}
            aria-pressed={areShortcutsVisible}
            className="size-11 shrink-0 rounded-full"
            size="icon"
            type="button"
            variant="ghost"
            onClick={() => setAreShortcutsVisible((isVisible) => !isVisible)}
          >
            <Plus aria-hidden="true" className="size-5" />
          </Button>
          <Textarea
            aria-label="Agent 指令"
            className="min-h-11 flex-1 resize-none border-0 bg-transparent px-1 py-3 text-base shadow-none focus-visible:ring-0"
            disabled={isSendingChat}
            id="agent-workbench-prompt"
            name="agent-workbench-prompt"
            placeholder="发消息或按住说话..."
            rows={1}
            value={promptText}
            onChange={(event) => onChangePromptText(event.target.value)}
          />
          <Button
            aria-label="发送"
            className="size-11 shrink-0 rounded-full"
            disabled={isSendingChat}
            size="icon"
            type="submit"
          >
            <Send aria-hidden="true" className="size-5" />
          </Button>
        </div>

        {areShortcutsVisible ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
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
      className="grid min-h-20 place-items-center gap-1 rounded-xl border border-border/55 bg-background/80 px-2 py-3 text-sm font-medium text-foreground shadow-sm transition-[background-color,border-color,box-shadow] duration-150 ease-(--ease-out-ui) hover:border-primary/35 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-5">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}

function ConversationTextMessage({ message }: { message: AgentConversationMessage }) {
  const isUser = message.role === "user";
  const hasText = Boolean(message.text.trim());

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(720px,100%)] rounded-xl border px-3 py-2 text-sm/6",
          isUser
            ? "border-primary/30 bg-primary/15 text-foreground"
            : "border-border/70 bg-background/65 text-foreground",
        )}
      >
        {hasText ? (
          isUser ? (
            <p className="wrap-break-word whitespace-pre-wrap">{message.text}</p>
          ) : (
            <MarkdownPreview
              className="max-w-none text-sm/6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              content={message.text}
              variant="stream"
            />
          )
        ) : (
          <StreamingMessageIndicator />
        )}
      </div>
    </div>
  );
}

function StreamingMessageIndicator() {
  return (
    <span aria-label="Agent 正在生成回复" className="flex h-6 items-center gap-1" role="status">
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/70" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:120ms]" />
      <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground/40 [animation-delay:240ms]" />
    </span>
  );
}

export { AgentWorkbenchShell };
