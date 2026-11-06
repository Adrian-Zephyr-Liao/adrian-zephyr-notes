// @vitest-environment jsdom

import type {
  AssistantActionResponse,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantActionCard, AssistantResult } from "./assistant-results";
import { AssistantTurn } from "./assistant-turn";

const api = vi.hoisted(() => ({
  decideAssistantAction: vi.fn<() => Promise<AssistantActionResponse>>(),
}));
vi.mock("./assistant-api", () => api);
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

describe("assistant business result cards", () => {
  it("keeps saved approvals read-only when current capabilities do not permit decisions", () => {
    render(<AssistantActionCard action={action()} allowDecisions={false} />);
    const confirm = screen.getByRole("button", { name: "确认隐藏评论" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(api.decideAssistantAction).not.toHaveBeenCalled();
  });
  it("renders a failed tool result as failure even when the assistant turn finished", () => {
    render(
      <AssistantResult
        result={{
          kind: "audit_logs",
          ok: false,
          error: { code: "QUERY_FAILED", message: "没有取得审计数据" },
        }}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("没有取得审计数据");
    expect(screen.queryByText("已执行")).toBeNull();
  });

  it("requires an explicit card decision and blocks duplicate clicks until the authoritative receipt arrives", async () => {
    let resolve!: (action: AssistantActionResponse) => void;
    api.decideAssistantAction.mockReturnValue(new Promise((done) => (resolve = done)));
    render(<AssistantActionCard action={action()} />);
    expect(api.decideAssistantAction).not.toHaveBeenCalled();
    expect(screen.getByText("需要核对的评论正文")).not.toBeNull();
    const confirm = screen.getByRole("button", { name: "确认隐藏评论" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(api.decideAssistantAction).toHaveBeenCalledTimes(1);
    expect(api.decideAssistantAction).toHaveBeenCalledWith("conversation-1", "action-1", "CONFIRM");
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("已执行")).toBeNull();
    await act(async () => resolve(appliedAction()));
    expect(screen.getByText("已执行")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "确认隐藏评论" })).toBeNull();
    expect(screen.getByText(/审计记录已保存/)).not.toBeNull();
  });

  it("sends only a rejection decision without claiming an applied effect", async () => {
    api.decideAssistantAction.mockResolvedValue({
      ...action(),
      status: "REJECTED",
      decidedAt: "2026-11-06T00:01:00.000Z",
    });
    render(<AssistantActionCard action={action()} />);
    fireEvent.click(screen.getByRole("button", { name: "拒绝操作" }));
    expect(await screen.findByText("已拒绝")).not.toBeNull();
    expect(api.decideAssistantAction).toHaveBeenCalledWith("conversation-1", "action-1", "REJECT");
    expect(screen.queryByText(/审计记录已保存/)).toBeNull();
  });

  it("deduplicates a saved preview against the current action and prefers the applied receipt", () => {
    const savedTurn: AssistantTurnResponse = {
      id: "turn-1",
      conversationId: "conversation-1",
      requestId: "request-1",
      input: "预览隐藏评论",
      status: "COMPLETED",
      messages: [],
      error: null,
      toolResults: [
        {
          name: "prepare_comment_status",
          toolCallId: "tool-1",
          result: { kind: "comment_action", ok: true, data: action() },
        },
      ],
      actions: [appliedAction()],
      createdAt: "2026-11-06T00:00:00.000Z",
      updatedAt: "2026-11-06T00:00:00.000Z",
    };
    render(<AssistantTurn turn={savedTurn} onReuseInput={() => {}} />);
    expect(screen.getAllByText("单条评论操作预览")).toHaveLength(1);
    expect(screen.getByText("已执行")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "确认隐藏评论" })).toBeNull();
  });
});

function action(): AssistantActionResponse {
  return {
    id: "action-1",
    turnId: "turn-1",
    conversationId: "conversation-1",
    status: "PENDING",
    commentId: "comment-1",
    commentBody: "需要核对的评论正文",
    authorLogin: "visitor",
    articleTitle: "测试文章",
    currentStatus: "VISIBLE",
    targetStatus: "HIDDEN",
    createdAt: "2026-11-06T00:00:00.000Z",
    decidedAt: null,
    receipt: null,
  };
}

function appliedAction(): AssistantActionResponse {
  return {
    ...action(),
    status: "APPLIED",
    decidedAt: "2026-11-06T00:01:00.000Z",
    receipt: {
      actionId: "action-1",
      commentId: "comment-1",
      previousStatus: "VISIBLE",
      status: "HIDDEN",
      auditLogId: "audit-1",
      appliedAt: "2026-11-06T00:01:00.000Z",
    },
  };
}
