// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SiteHeaderDisclosure } from "./site-header-disclosure";

afterEach(cleanup);

describe("site header disclosure", () => {
  it("returns keyboard focus to the summary when Escape closes an open menu", () => {
    renderMenu(true);
    const link = screen.getByRole("link", { name: "文章归档" });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });

    expect(screen.getByText("导航菜单").closest("details")?.open).toBe(false);
    expect(document.activeElement).toBe(screen.getByText("导航菜单"));
  });

  it("closes on outside interaction without taking focus from the outside control", () => {
    renderMenu(true);
    const outside = screen.getByRole("button", { name: "页面操作" });
    outside.focus();
    fireEvent.pointerDown(outside);

    expect(screen.getByText("导航菜单").closest("details")?.open).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it("does not move outside focus when Escape dismisses a menu", () => {
    renderMenu(true);
    const outside = screen.getByRole("button", { name: "页面操作" });
    outside.focus();
    fireEvent.keyDown(outside, { key: "Escape" });

    expect(screen.getByText("导航菜单").closest("details")?.open).toBe(false);
    expect(document.activeElement).toBe(outside);
  });

  it("does not take focus when the menu is already closed", () => {
    renderMenu(false);
    const outside = screen.getByRole("button", { name: "页面操作" });
    outside.focus();
    fireEvent.keyDown(outside, { key: "Escape" });

    expect(document.activeElement).toBe(outside);
  });

  it("preserves native link navigation while closing the menu", async () => {
    renderMenu(true);
    fireEvent.click(screen.getByRole("link", { name: "文章归档" }));
    await waitFor(() => expect(screen.getByText("导航菜单").closest("details")?.open).toBe(false));
  });
});

function renderMenu(open: boolean) {
  return render(
    <>
      <SiteHeaderDisclosure open={open}>
        <summary>导航菜单</summary>
        <a href="#archives">文章归档</a>
      </SiteHeaderDisclosure>
      <button type="button">页面操作</button>
    </>,
  );
}
