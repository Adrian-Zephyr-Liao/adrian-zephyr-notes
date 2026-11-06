import { expect, test, type Page } from "@playwright/test";
import { emptyComments, emptyGuestbook } from "./responses";

test("public reading pages render without script errors or horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const path of [
    "/",
    "/archives",
    "/categories",
    "/categories/engineering",
    "/tags",
    "/tags/design",
    "/posts/note-1",
    "/posts/note-4",
    "/comments",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
        message: `Overflow on ${path}`,
      })
      .toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});

test("theme choice persists after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "切换到亮色模式" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.getByRole("button", { name: "切换到暗色模式" })).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("keyboard carousel exposes only the active article", async ({ page }) => {
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "翻阅新近文章" });
  const activeCard = carousel.locator("article:not([inert])");
  await expect(activeCard).toHaveCount(1);
  await expect(activeCard.getByRole("link")).toHaveAttribute("href", "/posts/note-1");
  const next = carousel.getByRole("button", { name: "下一篇封面" });
  await next.focus();
  await page.keyboard.press("ArrowRight");
  await expect(activeCard.getByRole("link")).toHaveAttribute("href", "/posts/note-2");
  await expect(carousel.locator("article[inert] a")).toHaveCount(2);
  await expect(carousel.locator("[aria-live]")).toContainText("第 2 篇，共 3 篇");
  await page.keyboard.press("ArrowLeft");
  await expect(activeCard.getByRole("link")).toHaveAttribute("href", "/posts/note-1");
});

test("mobile navigation closes with Escape and restores keyboard focus", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "The mobile disclosure is hidden on desktop.");
  await page.goto("/");
  const menu = page.getByLabel("打开导航菜单");
  await menu.focus();
  await page.keyboard.press("Enter");
  const search = page.getByRole("link", { name: "搜索文章", exact: true });
  await expect(search).toBeVisible();
  await search.focus();
  await page.keyboard.press("Escape");
  await expect(search).not.toBeVisible();
  await expect(menu).toBeFocused();
});

test("touch swiping the cover turns a page without opening the article", async ({
  page,
  context,
  isMobile,
}) => {
  test.skip(!isMobile, "Real touch input is enabled in the mobile Chromium project.");
  await page.goto("/");
  const carousel = page.getByRole("region", { name: "翻阅新近文章" });
  const card = carousel.locator("article:not([inert]) a");
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.7;
  const y = box!.y + box!.height * 0.5;
  const session = await context.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (const distance of [20, 40, 60, 80]) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x - distance, y }],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
  await expect(card).toHaveAttribute("href", "/posts/note-2");
  await expect(page).toHaveURL("/");
});

test("archive search, pagination and view changes preserve active filters", async ({ page }) => {
  await page.goto("/archives?tag=design&view=timeline&page=2");
  await page.getByRole("searchbox", { name: "搜索文章" }).fill("设计 & 工程");
  await page.getByRole("combobox", { name: "文章分类" }).selectOption("engineering");
  await page.getByRole("button", { name: "查找" }).click();
  await expect
    .poll(() => query(page))
    .toEqual({ q: "设计 & 工程", category: "engineering", tag: "design", view: "timeline" });
  await page
    .getByRole("navigation", { name: "归档文章分页" })
    .getByRole("link", { name: "下一页" })
    .click();
  await expect
    .poll(() => query(page))
    .toEqual({
      q: "设计 & 工程",
      category: "engineering",
      tag: "design",
      page: "2",
      view: "timeline",
    });
  await page.getByRole("link", { name: "封面", exact: true }).click();
  await expect
    .poll(() => query(page))
    .toEqual({ q: "设计 & 工程", category: "engineering", tag: "design", page: "2" });
  await page.getByRole("link", { name: "移除分类：工程实践" }).click();
  await expect.poll(() => query(page)).toEqual({ q: "设计 & 工程", tag: "design" });
});

for (const discussion of [
  {
    name: "guestbook",
    path: "/comments",
    api: "**/api/guestbook/messages?*",
    retry: "重新加载留言",
    empty: "这里还留着空白",
    payload: emptyGuestbook,
  },
  {
    name: "article comments",
    path: "/posts/note-1",
    api: "**/api/articles/note-1/comments?*",
    retry: "重新加载评论",
    empty: "还没有评论",
    payload: emptyComments,
  },
]) {
  test(`${discussion.name} reports a read failure and recovers from its retry control`, async ({
    page,
  }) => {
    let reads = 0;
    await page.route(discussion.api, async (route) => {
      reads++;
      await route.fulfill(
        reads === 1
          ? { status: 503, json: { error: { message: "Temporarily unavailable" } } }
          : { json: discussion.payload },
      );
    });
    await page.goto(discussion.path);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByText(discussion.empty, { exact: true })).not.toBeVisible();
    await page.getByRole("button", { name: discussion.retry }).click();
    await expect(page.getByText(discussion.empty, { exact: true })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).not.toBeVisible();
    expect(reads).toBe(2);
  });
}

function query(page: Page) {
  return Object.fromEntries(new URL(page.url()).searchParams);
}
