// @vitest-environment jsdom

import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccount } from "../../components/admin/admin-account";
import { useAdminLogout } from "./use-admin-logout";

const admin: AdminUserResponse = {
  id: "admin",
  githubId: "1",
  login: "writer",
  name: null,
  avatarUrl: null,
  profileUrl: "https://example.invalid/writer",
  role: "ADMIN",
};
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("VITE_BACKEND_API_BASE_URL", "");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function Page({ onLogout, mobile = false }: { onLogout: () => void; mobile?: boolean }) {
  const [signedOut, setSignedOut] = useState(false);
  return signedOut ? (
    <h1>登录门禁</h1>
  ) : (
    <AccountPage
      mobile={mobile}
      onLogout={() => {
        onLogout();
        setSignedOut(true);
      }}
    />
  );
}
function AccountPage({ onLogout, mobile }: { onLogout: () => void; mobile: boolean }) {
  const desktop = useRef<HTMLButtonElement>(null),
    phone = useRef<HTMLButtonElement>(null);
  const logout = useAdminLogout(onLogout, [desktop, phone]);
  return (
    <>
      <div data-testid="desktop" style={{ display: mobile ? "none" : "block" }}>
        <AdminAccount
          admin={admin}
          buttonRef={desktop}
          onLogout={logout.requestLogout}
          pending={logout.pending}
        />
      </div>
      <div data-testid="mobile" style={{ display: mobile ? "block" : "none" }}>
        <AdminAccount
          admin={admin}
          buttonRef={phone}
          onLogout={logout.requestLogout}
          pending={logout.pending}
          showIdentity={false}
        />
      </div>
      <input aria-label="当前编辑稿" defaultValue="保留的文章正文" />
      {logout.feedback}
    </>
  );
}
function entry(kind: "desktop" | "mobile") {
  return within(screen.getByTestId(kind)).getByRole("button", { hidden: true });
}
function failure() {
  return new Response(JSON.stringify({ message: "service unavailable" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}
function deferred() {
  let resolve!: (response: Response) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<Response>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function expectOnlyLogoutPosts(count: number) {
  expect(fetchMock).toHaveBeenCalledTimes(count);
  for (const [url, init] of fetchMock.mock.calls) {
    expect(url).toBe("/api/auth/logout");
    expect(init).toMatchObject({ method: "POST", credentials: "include" });
  }
}

describe("shared page logout recovery", () => {
  it("locks both responsive entries synchronously and clears identity only on success", async () => {
    const request = deferred();
    fetchMock.mockReturnValue(request.promise);
    const onLogout = vi.fn();
    const view = render(
      <StrictMode>
        <Page onLogout={onLogout} />
      </StrictMode>,
    );
    const desktop = entry("desktop"),
      phone = entry("mobile");
    act(() => {
      fireEvent.click(desktop);
      fireEvent.click(phone);
      fireEvent.click(desktop);
    });
    expectOnlyLogoutPosts(1);
    for (const button of [desktop, phone]) {
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(button.getAttribute("aria-busy")).toBe("true");
    }
    expect(screen.getByRole("status").textContent).toBe("正在退出登录");
    view.rerender(
      <StrictMode>
        <Page onLogout={onLogout} mobile />
      </StrictMode>,
    );
    fireEvent.click(entry("mobile"));
    expectOnlyLogoutPosts(1);
    expect(onLogout).not.toHaveBeenCalled();
    await act(async () => request.resolve(new Response(null, { status: 204 })));
    expect(await screen.findByRole("heading", { name: "登录门禁" })).not.toBeNull();
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it.each(["503", "offline", "abort"])(
    "retains the page on %s and closes without another request",
    async (kind) => {
      if (kind === "503") fetchMock.mockResolvedValue(failure());
      else
        fetchMock.mockRejectedValue(
          kind === "abort"
            ? new DOMException("Aborted", "AbortError")
            : new TypeError("Failed to fetch"),
        );
      const onLogout = vi.fn();
      render(<Page onLogout={onLogout} />);
      const button = entry("desktop");
      fireEvent.click(button);
      const dialog = await screen.findByRole("alertdialog", { name: "未能确认退出登录" });
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
      const close = within(dialog).getByRole("button", { name: "关闭" });
      await waitFor(() => expect(document.activeElement).toBe(close));
      expect(onLogout).not.toHaveBeenCalled();
      fireEvent.click(close);
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(document.activeElement).toBe(button);
      expect((screen.getByLabelText("当前编辑稿") as HTMLInputElement).value).toBe(
        "保留的文章正文",
      );
      expectOnlyLogoutPosts(1);
    },
  );

  it("retries the same idempotent POST after a response is lost and can retry another failure", async () => {
    let serverSession = true;
    fetchMock
      .mockImplementationOnce(async () => {
        serverSession = false;
        throw new TypeError("response lost");
      })
      .mockResolvedValueOnce(failure())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const onLogout = vi.fn();
    render(<Page onLogout={onLogout} />);
    fireEvent.click(entry("desktop"));
    await screen.findByRole("alertdialog");
    expect(serverSession).toBe(false);
    expect(onLogout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "重试退出" }));
    await screen.findByRole("button", { name: "重试退出" });
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expectOnlyLogoutPosts(2);
    fireEvent.click(screen.getByRole("button", { name: "重试退出" }));
    expect(await screen.findByRole("heading", { name: "登录门禁" })).not.toBeNull();
    expect(onLogout).toHaveBeenCalledTimes(1);
    expectOnlyLogoutPosts(3);
  });

  it.each(["close", "Escape"])(
    "allows %s during retry, restores the visible entry and keeps the request locked",
    async (method) => {
      const retry = deferred();
      fetchMock.mockResolvedValueOnce(failure()).mockReturnValueOnce(retry.promise);
      const onLogout = vi.fn();
      const view = render(<Page onLogout={onLogout} />);
      fireEvent.click(entry("desktop"));
      await screen.findByRole("alertdialog");
      view.rerender(<Page onLogout={onLogout} mobile />);
      const retryButton = screen.getByRole("button", { name: "重试退出" });
      retryButton.focus();
      expect(document.activeElement).toBe(retryButton);
      fireEvent.click(retryButton);
      const close = screen.getByRole("button", { name: "关闭" }) as HTMLButtonElement;
      expect(close.disabled).toBe(false);
      expect(document.activeElement).toBe(close);
      const busy = screen.getByRole("button", { name: "退出中…" }) as HTMLButtonElement;
      expect(busy.disabled).toBe(true);
      fireEvent.click(busy);
      const dialog = screen.getByRole("alertdialog");
      if (method === "close") fireEvent.click(within(dialog).getByRole("button", { name: "关闭" }));
      else fireEvent.keyDown(dialog, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(document.activeElement).toBe(entry("mobile"));
      expect(entry("mobile").getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(entry("mobile"));
      expectOnlyLogoutPosts(2);
      expect(onLogout).not.toHaveBeenCalled();
      if (method === "close") {
        await act(async () => retry.resolve(new Response(null, { status: 204 })));
        expect(await screen.findByRole("heading", { name: "登录门禁" })).not.toBeNull();
        expect(onLogout).toHaveBeenCalledTimes(1);
      } else {
        await act(async () => retry.reject(new TypeError("response lost again")));
        expect(await screen.findByRole("alertdialog")).not.toBeNull();
        expect(onLogout).not.toHaveBeenCalled();
      }
    },
  );

  it("does not clear a different page after the request owner unmounts", async () => {
    const request = deferred();
    fetchMock.mockReturnValue(request.promise);
    const onLogout = vi.fn();
    const view = render(<Page onLogout={onLogout} />);
    fireEvent.click(entry("desktop"));
    view.unmount();
    await act(async () => request.resolve(new Response(null, { status: 204 })));
    expect(onLogout).not.toHaveBeenCalled();
  });
});
