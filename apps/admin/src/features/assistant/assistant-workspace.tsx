import { MarkdownPreview } from "@adrian-zephyr-notes/markdown";
import { Loader2, Plus, RefreshCw, Send, Square } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import {
  ManagementBody,
  ManagementHeader,
  ManagementLoading,
  ManagementSurface,
} from "../../components/ui/management-surface";
import { Textarea } from "../../components/ui/textarea";
import { AssistantTurn } from "./assistant-turn";
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
  const enabled = capabilities?.enabled === true;
  const toolLabel = capabilities?.tools.find(
    (tool) => tool.name === conversation.pending?.toolName,
  )?.label;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || conversation.busy || !input.trim()) return;
    const message = input.trim();
    setInput("");
    void conversation.send(message);
  }

  return (
    <ManagementSurface>
      <ManagementHeader
        action={
          <div className="flex gap-2">
            {conversation.history ? (
              <Button
                disabled={conversation.sending || conversation.loading}
                onClick={() => void conversation.refresh()}
                size="sm"
                variant="outline"
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
        description="查询结果可核对；评论修改需要在预览卡片上单独确认。"
        title="管理助手"
      />
      <ManagementBody className="space-y-5">
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
        {enabled ? (
          <p className="text-xs text-muted-foreground">
            当前可用：{capabilities.tools.map((tool) => tool.label).join("、") || "暂无可用能力"}
          </p>
        ) : null}

        {conversation.loading ? <ManagementLoading label="正在读取会话记录" /> : null}
        {!conversation.loading && !conversation.history?.turns.length && !conversation.pending ? (
          <div className="rounded-lg bg-background/20 px-4 py-8">
            <h3 className="text-sm font-medium">从一个具体问题开始</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              例如查询审计记录，或说明要查找的评论条件。只提供完成当前问题所需的信息。
            </p>
            {enabled ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {capabilities.tools
                  .filter((tool) => tool.name in exampleQuestions)
                  .map((tool) => (
                    <Button
                      key={tool.name}
                      onClick={() => setInput(exampleQuestions[tool.name])}
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
            onClick={() => void conversation.refresh(conversation.history?.nextBefore ?? undefined)}
            size="sm"
            variant="ghost"
          >
            加载更早记录
          </Button>
        ) : null}
        <div aria-label="会话记录" className="space-y-5" role="log">
          {conversation.history?.turns
            .filter((turn) => turn.requestId !== conversation.pending?.requestId)
            .map((turn) => (
              <AssistantTurn
                key={turn.id}
                onReuseInput={setInput}
                turn={turn}
                allowDecisions={enabled && capabilities.tools.some((tool) => !tool.readOnly)}
              />
            ))}
          {conversation.pending ? (
            <article className="space-y-4">
              <div className="ml-auto max-w-[90%] rounded-lg bg-primary/10 px-4 py-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">你</p>
                <p className="text-sm whitespace-pre-wrap">{conversation.pending.input}</p>
              </div>
              {conversation.pending.text ? (
                <MarkdownPreview content={conversation.pending.text} variant="stream" />
              ) : null}
              {conversation.sending ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
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
          <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
            {conversation.error}
          </p>
        ) : null}
        {conversation.retry ? (
          <Button
            disabled={!enabled || conversation.sending}
            onClick={() => {
              if (conversation.retry)
                void conversation.send(conversation.retry.input, conversation.retry.requestId);
            }}
            size="sm"
            variant="outline"
          >
            核对并重试原请求
          </Button>
        ) : null}
        <form className="space-y-3 border-t border-border/45 pt-4" onSubmit={submit}>
          <label className="block text-sm font-medium" htmlFor="assistant-input">
            你的问题
          </label>
          <Textarea
            disabled={!enabled || conversation.busy || conversation.loading}
            id="assistant-input"
            onChange={(event) => setInput(event.target.value)}
            placeholder="说明想查询的内容和筛选条件…"
            value={input}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">结果以保存的业务记录与操作回执为准。</p>
            {conversation.activeRequestId && conversation.busy ? (
              <Button
                disabled={conversation.stopping}
                onClick={() => void conversation.stop()}
                type="button"
                variant="outline"
              >
                {conversation.stopping ? <Loader2 className="animate-spin" /> : <Square />}
                {conversation.stopping ? "停止中" : "停止请求"}
              </Button>
            ) : null}
            <Button
              disabled={!enabled || conversation.busy || conversation.loading || !input.trim()}
              type="submit"
            >
              <Send />
              发送
            </Button>
          </div>
        </form>
      </ManagementBody>
    </ManagementSurface>
  );
}

const exampleQuestions: Record<string, string> = {
  list_audit_logs: "查看审计日志",
  search_comments: "搜索可见评论",
};

export { AssistantWorkspace };
