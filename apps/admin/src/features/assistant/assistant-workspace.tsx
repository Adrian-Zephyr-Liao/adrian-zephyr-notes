import { ArrowDown, Loader2, Plus, RefreshCw } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  ManagementBody,
  ManagementHeader,
  ManagementLoading,
  ManagementSurface,
} from "../../components/ui/management-surface";
import { AssistantComposer } from "./assistant-composer";
import { AssistantMessage, AssistantTurn } from "./assistant-turn";
import { useAssistantCapabilities } from "./use-assistant-capabilities";
import { useAssistantConversation } from "./use-assistant-conversation";

function AssistantWorkspace({
  conversationId,
  onConversationChange,
}: {
  conversationId?: string;
  onConversationChange: (id: string | undefined) => void;
}) {
  const { capabilities, loading: capabilitiesLoading, failed } = useAssistantCapabilities();
  const conversation = useAssistantConversation(conversationId, onConversationChange);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const olderAnchor = useRef<{ height: number; top: number } | null>(null);
  const [awayFromLatest, setAwayFromLatest] = useState(false);
  const enabled = capabilities?.enabled === true;
  const historyUnavailable = Boolean(conversationId && !conversation.history);
  const toolLabel = capabilities?.tools.find(
    (tool) => tool.name === conversation.pending?.toolName,
  )?.label;

  useEffect(() => {
    setInput("");
    followLatest.current = true;
    olderAnchor.current = null;
    setAwayFromLatest(false);
  }, [conversationId]);

  useLayoutEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    if (olderAnchor.current) {
      if (!conversation.loading) {
        viewport.scrollTop =
          olderAnchor.current.top + viewport.scrollHeight - olderAnchor.current.height;
        olderAnchor.current = null;
      }
      return;
    }
    if (followLatest.current) viewport.scrollTop = viewport.scrollHeight;
  }, [conversation.history, conversation.loading, conversation.pending, conversation.error]);

  useEffect(() => {
    const viewport = scrollRef.current;
    const content = viewport?.firstElementChild;
    if (!viewport || !content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (followLatest.current && !olderAnchor.current) viewport.scrollTop = viewport.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  function reuseInput(value: string) {
    setInput(value);
    inputRef.current?.focus();
  }

  function submit() {
    const message = input.trim();
    setInput("");
    followLatest.current = true;
    setAwayFromLatest(false);
    void conversation.send(message);
  }

  return (
    <ManagementSurface className="flex min-h-0 flex-1 flex-col rounded-none border-0 bg-transparent">
      <ManagementHeader
        className="mx-auto w-full max-w-3xl shrink-0 px-0 pt-0 pb-3 sm:px-0"
        action={
          <div className="flex gap-2">
            {conversationId || conversation.history ? (
              <Button
                disabled={conversation.sending || conversation.loading}
                onClick={() => void conversation.refresh()}
                size="sm"
                variant="ghost"
              >
                <RefreshCw />
                刷新状态
              </Button>
            ) : null}
            <Button
              disabled={conversation.busy || conversation.loading}
              onClick={() => {
                conversation.newConversation();
                setInput("");
              }}
              size="sm"
              variant="outline"
            >
              <Plus />
              新会话
            </Button>
          </div>
        }
        description={
          enabled
            ? `当前可用：${capabilities.tools.map((tool) => tool.label).join("、") || "暂无可用能力"}`
            : "核对已保存的业务记录与操作回执。"
        }
        title={conversationId || conversation.history ? "当前会话" : "开始查询"}
      />
      <ManagementBody className="flex min-h-0 flex-1 flex-col gap-3 space-y-0 px-0 pb-0 sm:px-0 sm:pb-0">
        {capabilitiesLoading ? <ManagementLoading label="正在读取可用能力" /> : null}
        {failed ? (
          <p className="text-sm text-destructive" role="alert">
            可用能力读取失败，请刷新页面后重试。
          </p>
        ) : null}
        {capabilities && !enabled ? (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground" role="status">
            助手当前未开放。已有会话仍可核对保存的记录。
          </p>
        ) : null}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div
            role="region"
            aria-label="会话阅读区"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-sm pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            onScroll={() => {
              const viewport = scrollRef.current;
              if (!viewport) return;
              const atLatest =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 64;
              followLatest.current = atLatest;
              setAwayFromLatest(!atLatest);
            }}
            ref={scrollRef}
            tabIndex={0}
          >
            <div className="mx-auto w-full max-w-3xl space-y-5 pb-3 wrap-anywhere">
              {conversation.loading && !conversation.history ? (
                <ManagementLoading label="正在读取会话记录" />
              ) : null}
              {!capabilitiesLoading &&
              !failed &&
              !conversation.loading &&
              !historyUnavailable &&
              !conversation.history?.turns.length &&
              !conversation.pending ? (
                <div className="px-1 py-6 sm:pt-10">
                  <h3 className="text-xl font-semibold tracking-tight">从一个具体问题开始</h3>
                  <p className="mt-3 max-w-md text-sm/relaxed text-muted-foreground">
                    例如查询审计记录，或说明要查找的评论条件。只提供完成当前问题所需的信息。
                  </p>
                  {enabled ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {capabilities.tools
                        .filter((tool) => tool.name in exampleQuestions)
                        .map((tool) => (
                          <Button
                            key={tool.name}
                            onClick={() => reuseInput(exampleQuestions[tool.name])}
                            size="sm"
                            variant="outline"
                          >
                            {exampleQuestions[tool.name]}
                          </Button>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {conversation.history?.nextBefore ? (
                <Button
                  disabled={conversation.loading || conversation.sending}
                  onClick={() => {
                    const viewport = scrollRef.current;
                    if (viewport)
                      olderAnchor.current = {
                        height: viewport.scrollHeight,
                        top: viewport.scrollTop,
                      };
                    followLatest.current = false;
                    void conversation.refresh(conversation.history?.nextBefore ?? undefined);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  {conversation.loading ? "正在读取更早记录" : "加载更早记录"}
                </Button>
              ) : null}
              <div aria-label="会话记录" className="space-y-5" role="log">
                {conversation.history?.turns
                  .filter((turn) => turn.requestId !== conversation.pending?.requestId)
                  .map((turn) => (
                    <AssistantTurn
                      key={turn.id}
                      onReuseInput={reuseInput}
                      turn={turn}
                      allowDecisions={enabled && capabilities.tools.some((tool) => !tool.readOnly)}
                    />
                  ))}
                {conversation.pending ? (
                  <article className="space-y-4">
                    <AssistantMessage content={conversation.pending.input} role="user" />
                    {conversation.pending.text ? (
                      <AssistantMessage content={conversation.pending.text} role="assistant" />
                    ) : null}
                    {conversation.sending ? (
                      <p
                        className="flex items-center gap-2 text-xs text-muted-foreground"
                        role="status"
                      >
                        <Loader2 className="size-3.5 animate-spin" />
                        {conversation.stopping
                          ? "正在停止，请等待确认"
                          : toolLabel
                            ? `正在${toolLabel}`
                            : "正在处理请求"}
                      </p>
                    ) : null}
                  </article>
                ) : null}
              </div>
              {conversation.error ? (
                <p
                  className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {conversation.error}
                </p>
              ) : null}
              {historyUnavailable && !conversation.loading ? (
                <Button onClick={() => void conversation.refresh()} size="sm" variant="outline">
                  <RefreshCw />
                  重新读取会话
                </Button>
              ) : null}
              {conversation.retry ? (
                <Button
                  disabled={!enabled || conversation.sending}
                  onClick={() => {
                    if (conversation.retry)
                      void conversation.send(
                        conversation.retry.input,
                        conversation.retry.requestId,
                      );
                  }}
                  size="sm"
                  variant="outline"
                >
                  核对并重试原请求
                </Button>
              ) : null}
            </div>
          </div>
          {awayFromLatest ? (
            <Button
              className="absolute right-3 bottom-3"
              onClick={() => {
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                followLatest.current = true;
                setAwayFromLatest(false);
              }}
              size="sm"
              variant="outline"
            >
              <ArrowDown />
              回到最新
            </Button>
          ) : null}
        </div>
        <AssistantComposer
          canStop={Boolean(conversation.activeRequestId && conversation.busy)}
          disabled={!enabled || conversation.busy || conversation.loading || historyUnavailable}
          input={input}
          inputRef={inputRef}
          onInputChange={setInput}
          onStop={() => void conversation.stop()}
          onSubmit={submit}
          stopping={conversation.stopping}
        />
      </ManagementBody>
    </ManagementSurface>
  );
}

const exampleQuestions: Record<string, string> = {
  list_audit_logs: "查看审计日志",
  search_comments: "搜索可见评论",
};

export { AssistantWorkspace };
