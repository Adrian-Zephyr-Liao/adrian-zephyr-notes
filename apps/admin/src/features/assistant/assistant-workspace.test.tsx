// @vitest-environment jsdom

import type {
  AssistantCapabilitiesResponse,
  AssistantConversationResponse,
  AssistantHistoryResponse,
  AssistantTurnResponse,
} from "@adrian-zephyr-notes/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantStreamInput, AssistantStreamResult } from "./assistant-stream";
import { AssistantWorkspace } from "./assistant-workspace";

const api = vi.hoisted(() => ({
  getAssistantCapabilities: vi.fn<() => Promise<AssistantCapabilitiesResponse>>(),
  createAssistantConversation: vi.fn<() => Promise<AssistantConversationResponse>>(),
  getAssistantHistory: vi.fn<() => Promise<AssistantHistoryResponse>>(),
  getAssistantTurn:
    vi.fn<(conversationId: string, requestId: string) => Promise<AssistantTurnResponse>>(),
  stopAssistantTurn:
    vi.fn<(conversationId: string, requestId: string) => Promise<AssistantTurnResponse>>(),
}));
const transport = vi.hoisted(() => ({
  streamAssistantTurn: vi.fn<
    (input: AssistantStreamInput) => {
      abort: () => void;
      finished: Promise<AssistantStreamResult>;
    }
  >(),
}));
vi.mock("./assistant-api", () => api);
vi.mock("./assistant-stream", () => transport);

beforeEach(() => {
  vi.resetAllMocks();
  api.getAssistantCapabilities.mockResolvedValue({
    enabled: true,
    tools: [
      {
        name: "list_audit_logs",
        label: "查询审计日志",
        description: "查询实际审计记录",
        readOnly: true,
      },
    ],
  });
  api.createAssistantConversation.mockResolvedValue(conversation());
  api.getAssistantHistory.mockResolvedValue({
    conversation: conversation(),
    turns: [],
    nextBefore: null,
  });
  api.getAssistantTurn.mockImplementation((_conversationId, requestId) =>
    Promise.resolve(turn({ requestId })),
  );
  transport.streamAssistantTurn.mockReturnValue({
    abort: vi.fn(),
    finished: Promise.resolve({ terminal: "finished" }),
  });
});
afterEach(cleanup);

describe("AssistantWorkspace", () => {
  it("keeps execution unavailable when the server disables the assistant", async () => {
    api.getAssistantCapabilities.mockResolvedValue({ enabled: false, tools: [] });
    render(<AssistantWorkspace onConversationChange={() => {}} />);
    expect(await screen.findByText("助手当前未开放。已有会话仍可核对保存的记录。")).not.toBeNull();
    expect((screen.getByLabelText("你的问题") as HTMLTextAreaElement).disabled).toBe(true);
    expect(api.createAssistantConversation).not.toHaveBeenCalled();
    expect(transport.streamAssistantTurn).not.toHaveBeenCalled();
  });

  it("loads canonical history in React StrictMode and does not trust a successful stream over saved failure", async () => {
    render(
      <StrictMode>
        <AssistantWorkspace conversationId="conversation-1" onConversationChange={() => {}} />
      </StrictMode>,
    );
    await waitFor(() =>
      expect((screen.getByLabelText("你的问题") as HTMLTextAreaElement).disabled).toBe(false),
    );
    api.getAssistantTurn.mockImplementation((_conversationId, requestId) =>
      Promise.resolve(
        turn({
          requestId,
          status: "FAILED",
          messages: [],
          error: { code: "QUERY_FAILED", message: "审计查询未完成" },
        }),
      ),
    );
    ask("查看审计日志");
    expect(await screen.findByText("请求失败")).not.toBeNull();
    expect(screen.getByText("审计查询未完成")).not.toBeNull();
    expect(screen.queryByText("回答完成")).toBeNull();
  });

  it("retries an uncertain submission with the same request identity and replaces streamed text with canonical history", async () => {
    transport.streamAssistantTurn.mockImplementationOnce((input) => {
      input.onTextDelta("哈", "stream-message");
      input.onTextDelta("哈", "stream-message");
      return { abort: vi.fn(), finished: Promise.resolve({ terminal: "interrupted" }) };
    });
    api.getAssistantTurn.mockRejectedValueOnce(new Error("offline"));
    const onConversationChange = vi.fn();
    render(<AssistantWorkspace onConversationChange={onConversationChange} />);
    await waitFor(() =>
      expect((screen.getByLabelText("你的问题") as HTMLTextAreaElement).disabled).toBe(false),
    );
    ask("查看审计日志");
    fireEvent.click(await screen.findByRole("button", { name: "核对并重试原请求" }));
    expect(await screen.findByText("回答完成")).not.toBeNull();
    expect(transport.streamAssistantTurn).toHaveBeenCalledTimes(2);
    expect(transport.streamAssistantTurn.mock.calls[1][0].requestId).toBe(
      transport.streamAssistantTurn.mock.calls[0][0].requestId,
    );
    expect(api.createAssistantConversation).toHaveBeenCalledTimes(1);
    expect(onConversationChange).toHaveBeenCalledWith("conversation-1");
    expect(screen.getAllByText("查看审计日志")).toHaveLength(1);
    expect(screen.queryByText("哈哈")).toBeNull();
  });

  it("shows stopping until the server confirms cancellation, without duplicating the pending input", async () => {
    let finish!: (result: AssistantStreamResult) => void;
    const finished = new Promise<AssistantStreamResult>((resolve) => (finish = resolve));
    transport.streamAssistantTurn.mockImplementation((input) => {
      input.onStarted?.();
      return { abort: vi.fn(), finished };
    });
    api.stopAssistantTurn.mockImplementation((_conversationId, requestId) =>
      Promise.resolve(turn({ requestId, status: "CANCELLING" })),
    );
    api.getAssistantTurn.mockImplementation((_conversationId, requestId) =>
      Promise.resolve(turn({ requestId, status: "CANCELLED", messages: [] })),
    );
    render(<AssistantWorkspace onConversationChange={() => {}} />);
    await waitFor(() =>
      expect((screen.getByLabelText("你的问题") as HTMLTextAreaElement).disabled).toBe(false),
    );
    ask("查看审计日志");
    fireEvent.click(await screen.findByRole("button", { name: "停止请求" }));
    const stopping = await screen.findByRole("button", { name: "停止中" });
    expect((stopping as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("已停止")).toBeNull();
    expect(screen.getAllByText("查看审计日志")).toHaveLength(1);
    await act(async () => finish({ terminal: "error" }));
    expect(await screen.findByText("已停止")).not.toBeNull();
    expect(screen.queryByText("回答完成")).toBeNull();
  });

  it("reconciles an uncertain streamed request when refreshed history contains its saved result", async () => {
    transport.streamAssistantTurn.mockImplementation((input) => {
      input.onTextDelta("尚未核对的片段", "stream-message");
      return { abort: vi.fn(), finished: Promise.resolve({ terminal: "interrupted" }) };
    });
    api.getAssistantTurn.mockRejectedValueOnce(new Error("offline"));
    render(<AssistantWorkspace onConversationChange={() => {}} />);
    await waitFor(() =>
      expect((screen.getByLabelText("你的问题") as HTMLTextAreaElement).disabled).toBe(false),
    );
    ask("查看审计日志");
    await screen.findByRole("button", { name: "核对并重试原请求" });
    const requestId = transport.streamAssistantTurn.mock.calls[0][0].requestId;
    api.getAssistantHistory.mockResolvedValue({
      conversation: conversation(),
      turns: [turn({ requestId })],
      nextBefore: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "刷新状态" }));
    expect(await screen.findByText("已返回实际记录。")).not.toBeNull();
    expect(screen.queryByText("尚未核对的片段")).toBeNull();
    expect(screen.queryByRole("button", { name: "核对并重试原请求" })).toBeNull();
    expect(screen.getAllByText("查看审计日志")).toHaveLength(1);
  });
});

function ask(input: string) {
  fireEvent.change(screen.getByLabelText("你的问题"), { target: { value: input } });
  fireEvent.click(screen.getByRole("button", { name: "发送" }));
}

function conversation(): AssistantConversationResponse {
  return {
    id: "conversation-1",
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
  };
}

function turn(overrides: Partial<AssistantTurnResponse> = {}): AssistantTurnResponse {
  return {
    id: "turn-1",
    conversationId: "conversation-1",
    requestId: "request-1",
    input: "查看审计日志",
    status: "COMPLETED",
    messages: [
      { id: "message-1", role: "user", content: "查看审计日志" },
      { id: "message-2", role: "assistant", content: "已返回实际记录。" },
    ],
    toolResults: [],
    actions: [],
    error: null,
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
    ...overrides,
  };
}
