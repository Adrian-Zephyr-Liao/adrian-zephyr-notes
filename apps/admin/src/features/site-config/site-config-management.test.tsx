// @vitest-environment jsdom
import type { AdminSiteConfigResponse } from "@adrian-zephyr-notes/contracts";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteConfigManagement } from "./site-config-management";

const api = vi.hoisted(() => ({
  getAdminSiteConfig: vi.fn(),
  updateAdminSiteAnnouncement: vi.fn(),
  updateAdminSiteSettings: vi.fn(),
}));
vi.mock("../../lib/admin-api", () => api);
beforeEach(() => {
  vi.resetAllMocks();
  api.getAdminSiteConfig.mockResolvedValue(config());
});
afterEach(cleanup);

describe("site configuration workspace", () => {
  it("previews draft home and navigation edits while saving only after confirmation", async () => {
    api.updateAdminSiteSettings.mockImplementation(async (settings) => ({
      ...config(),
      ...settings,
    }));
    render(<SiteConfigManagement />);
    const title = await screen.findByLabelText("标题");
    fireEvent.change(title, { target: { value: "记录生活与创造" } });
    const preview = screen.getByRole("complementary", { name: "配置预览" });
    expect(within(preview).getByRole("heading", { name: "记录生活与创造" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "导航" }));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "我的文章" } });
    expect(within(preview).getByText("我的文章")).not.toBeNull();
    expect(api.updateAdminSiteSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));
    let dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "取消" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(api.updateAdminSiteSettings).not.toHaveBeenCalled();
    expect(within(preview).getByRole("heading", { name: "记录生活与创造" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "保存更改" }));
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "保存更改" }));
    await waitFor(() => expect(api.updateAdminSiteSettings).toHaveBeenCalledOnce());
    expect(api.updateAdminSiteSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        home: expect.objectContaining({ title: "记录生活与创造" }),
        navigationItems: [expect.objectContaining({ label: "我的文章" })],
        socialLinks: [],
      }),
    );
  });
});

function config(): AdminSiteConfigResponse {
  return {
    announcements: [],
    home: {
      eyebrow: "AZ Notes",
      title: "日常记录",
      subtitle: "写作与创造",
      primaryActionLabel: "开始阅读",
      primaryActionHref: "/articles",
      secondaryActionLabel: null,
      secondaryActionHref: null,
    },
    navigationItems: [
      {
        id: "articles",
        label: "文章",
        href: "/articles",
        isEnabled: true,
        isExternal: false,
        sortOrder: 10,
      },
    ],
    socialLinks: [],
  };
}
