// @vitest-environment jsdom

import type {
  AdminUserResponse,
  AssistantCapabilitiesResponse,
} from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminShell } from "./admin-shell";

const api = vi.hoisted(() => ({
  getAssistantCapabilities: vi.fn<() => Promise<AssistantCapabilitiesResponse>>(),
}));
vi.mock("../../features/assistant/assistant-api", () => api);
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
beforeEach(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

describe("assistant navigation", () => {
  it("exposes the entry only after the current administrator receives enabled capabilities", async () => {
    api.getAssistantCapabilities.mockResolvedValue({ enabled: false, tools: [] });
    const { rerender } = render(shell("admin-1"));
    await waitFor(() => expect(api.getAssistantCapabilities).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("link", { name: "管理助手" })).toBeNull();
    api.getAssistantCapabilities.mockResolvedValue({ enabled: true, tools: [] });
    rerender(shell("admin-2"));
    expect(await screen.findByRole("link", { name: "管理助手" })).not.toBeNull();
    api.getAssistantCapabilities.mockRejectedValue(new Error("unavailable"));
    rerender(shell("admin-3"));
    await waitFor(() => expect(screen.queryByRole("link", { name: "管理助手" })).toBeNull());
    expect(screen.getByRole("link", { name: "评论" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "审计日志" })).not.toBeNull();
  });
});

function shell(id: string) {
  const admin: AdminUserResponse = {
    id,
    githubId: "1",
    login: "admin",
    name: null,
    avatarUrl: null,
    profileUrl: "https://github.com/admin",
    role: "ADMIN",
  };
  return (
    <AdminShell admin={admin} onLogout={() => {}} section="overview">
      <p>普通管理内容</p>
    </AdminShell>
  );
}

it("opens the mobile navigation and returns focus to its trigger on Escape", async () => {
  api.getAssistantCapabilities.mockResolvedValue({ enabled: false, tools: [] });
  render(shell("admin-1"));
  const trigger = screen.getByRole("button", { name: "打开管理导航" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog", { name: "内容工作台" });
  expect(within(dialog).getByRole("link", { name: "评论" })).not.toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(trigger));
});
