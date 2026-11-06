// @vitest-environment jsdom

import type { AdminUserResponse } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OAuthConsentPage } from "./oauth-consent-page";

const apiMocks = vi.hoisted(() => ({
  getOAuthConsent: vi.fn(),
  decideOAuthAuthorization: vi.fn(),
}));

vi.mock("./oauth-api", () => apiMocks);

const admin: AdminUserResponse = {
  id: "admin-1",
  githubId: "123",
  login: "blog-owner",
  name: null,
  avatarUrl: null,
  profileUrl: "https://github.com/blog-owner",
  role: "ADMIN",
};

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.getOAuthConsent.mockResolvedValue({
    clientName: "AZ Notes CLI",
    userCode: "ABCD-EFGH",
    scopes: ["articles:read", "articles:write"],
  });
});

afterEach(() => cleanup());

describe("OAuthConsentPage", () => {
  it("loads the device request but never automatically approves it", async () => {
    render(<OAuthConsentPage admin={admin} initialUserCode="abcd-efgh" />);

    await screen.findByRole("button", { name: "允许访问" });
    expect(apiMocks.getOAuthConsent).toHaveBeenCalledWith("ABCD-EFGH", expect.any(AbortSignal));
    expect(screen.getByText("@blog-owner")).not.toBeNull();
    expect(screen.getByText("创建、修改和发布文章")).not.toBeNull();
    expect(apiMocks.decideOAuthAuthorization).not.toHaveBeenCalled();
  });

  it("clearly discloses full administrator read and write permissions", async () => {
    apiMocks.getOAuthConsent.mockResolvedValue({
      clientName: "AZ Notes CLI",
      userCode: "ABCD-EFGH",
      scopes: ["admin:read", "admin:write"],
    });
    render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);

    await screen.findByRole("button", { name: "允许访问" });

    expect(
      screen.getByText(
        "读取全部后台内容，包括文章与草稿、评论、留言、站点配置、审计日志和助手会话",
      ),
    ).not.toBeNull();
    expect(
      screen.getByText(
        "执行完整管理员操作，包括创建、修改和删除内容，上传图片，审核评论与留言，修改站点配置和公告，运行助手并审批操作",
      ),
    ).not.toBeNull();
    expect(screen.getByText(/此授权包含完整后台管理权限/)).not.toBeNull();
    expect(screen.queryByText(/此授权仅用于文章/)).toBeNull();
    expect(apiMocks.decideOAuthAuthorization).not.toHaveBeenCalled();
  });

  it("distinguishes all-admin read-only access from write permission and preserves legacy article grants", async () => {
    apiMocks.getOAuthConsent.mockResolvedValueOnce({
      clientName: "AZ Notes CLI",
      userCode: "ABCD-EFGH",
      scopes: ["admin:read"],
    });
    const page = render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);

    await screen.findByRole("button", { name: "允许访问" });
    expect(screen.getByText(/不允许上传、修改、删除或审批/)).not.toBeNull();
    expect(screen.queryByText(/执行完整管理员操作/)).toBeNull();
    page.unmount();

    render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);
    await screen.findByRole("button", { name: "允许访问" });
    expect(screen.getByText("创建、修改和发布文章")).not.toBeNull();
    expect(screen.getByText(/此授权仅用于文章/)).not.toBeNull();
  });

  it("does not call mixed admin-read and article-write grants read-only", async () => {
    apiMocks.getOAuthConsent.mockResolvedValue({
      clientName: "AZ Notes CLI",
      userCode: "ABCD-EFGH",
      scopes: ["admin:read", "articles:write"],
    });
    render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);

    await screen.findByRole("button", { name: "允许访问" });

    expect(screen.getByText(/修改权限仅限以上列出的文章操作/)).not.toBeNull();
    expect(screen.queryByText(/不允许上传、修改、删除或审批/)).toBeNull();
  });

  it.each([
    ["allow", "允许访问", "approved", "已允许访问"],
    ["deny", "拒绝", "denied", "已拒绝访问"],
  ])(
    "submits only the displayed code for %s and shows the confirmed result",
    async (decision, label, status, resultLabel) => {
      apiMocks.decideOAuthAuthorization.mockResolvedValue({ status });
      render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);

      fireEvent.click(await screen.findByRole("button", { name: label }));

      await screen.findByText(resultLabel);
      expect(apiMocks.decideOAuthAuthorization).toHaveBeenCalledExactlyOnceWith({
        user_code: "ABCD-EFGH",
        decision,
      });
      expect(screen.queryByRole("button", { name: "允许访问" })).toBeNull();
      expect(screen.getByText("请返回 CLI 查看结果。你可以关闭此页面。")).not.toBeNull();
    },
  );

  it.each([
    ["allow", "允许访问", "拒绝", "重试允许", "approved", "已允许访问"],
    ["deny", "拒绝", "允许访问", "重试拒绝", "denied", "已拒绝访问"],
  ])(
    "preserves the original %s decision and code after a lost response",
    async (decision, label, oppositeLabel, retryLabel, status, resultLabel) => {
      let rejectDecision: (error: Error) => void = () => {};
      apiMocks.decideOAuthAuthorization.mockReturnValueOnce(
        new Promise((_, reject) => {
          rejectDecision = reject;
        }),
      );
      render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);

      const submit = await screen.findByRole("button", { name: label });
      fireEvent.click(submit);
      fireEvent.click(submit);

      expect(apiMocks.decideOAuthAuthorization).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("button", { name: oppositeLabel }).hasAttribute("disabled")).toBe(
        true,
      );
      rejectDecision(new Error("连接已断开。"));

      await screen.findByRole("alert");
      expect(screen.getByRole("alert").textContent).toContain("决定可能已保存");
      expect(screen.queryByText(resultLabel)).toBeNull();
      expect(screen.getByRole("button", { name: oppositeLabel }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(screen.getByLabelText("CLI 显示的授权码").hasAttribute("disabled")).toBe(true);
      expect(screen.getByRole("button", { name: "查找授权请求" }).hasAttribute("disabled")).toBe(
        true,
      );

      fireEvent.click(screen.getByRole("button", { name: oppositeLabel }));
      expect(apiMocks.decideOAuthAuthorization).toHaveBeenCalledTimes(1);
      apiMocks.decideOAuthAuthorization.mockResolvedValueOnce({ status });
      fireEvent.click(screen.getByRole("button", { name: retryLabel }));

      await screen.findByText(resultLabel);
      expect(apiMocks.decideOAuthAuthorization).toHaveBeenCalledTimes(2);
      expect(apiMocks.decideOAuthAuthorization).toHaveBeenNthCalledWith(1, {
        user_code: "ABCD-EFGH",
        decision,
      });
      expect(apiMocks.decideOAuthAuthorization).toHaveBeenNthCalledWith(2, {
        user_code: "ABCD-EFGH",
        decision,
      });
    },
  );

  it("accepts a manually entered code and lets a failed lookup be retried", async () => {
    apiMocks.getOAuthConsent.mockRejectedValueOnce(new Error("未找到授权请求"));
    render(<OAuthConsentPage admin={admin} initialUserCode="" />);

    expect(apiMocks.getOAuthConsent).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("CLI 显示的授权码"), {
      target: { value: " abcd-efgh " },
    });
    fireEvent.click(screen.getByRole("button", { name: "查找授权请求" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "允许访问" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "查找授权请求" }));

    await screen.findByRole("button", { name: "允许访问" });
    expect(apiMocks.getOAuthConsent).toHaveBeenLastCalledWith("ABCD-EFGH", expect.any(AbortSignal));
  });

  it("does not show authorization controls for unsupported permissions or a stale lookup", async () => {
    let resolveLookup: (value: unknown) => void = () => {};
    apiMocks.getOAuthConsent.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      }),
    );
    const view = render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);
    view.unmount();
    resolveLookup({ clientName: "AZ Notes CLI", userCode: "ABCD-EFGH", scopes: ["articles:read"] });

    apiMocks.getOAuthConsent.mockResolvedValue({
      clientName: "AZ Notes CLI",
      userCode: "ABCD-EFGH",
      scopes: ["site:write"],
    });
    render(<OAuthConsentPage admin={admin} initialUserCode="ABCD-EFGH" />);

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("不支持的权限"));
    expect(screen.queryByRole("button", { name: "允许访问" })).toBeNull();
    expect(apiMocks.decideOAuthAuthorization).not.toHaveBeenCalled();
  });
});
