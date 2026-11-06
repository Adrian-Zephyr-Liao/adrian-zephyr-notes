import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`${theme} reading surfaces have no detected accessibility violations`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const path of ["/", "/archives", "/comments", "/posts/note-1"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations.map(({ id, nodes }) => ({
          id,
          targets: nodes.map(({ target }) => target),
        })),
        `Accessibility violations on ${path} in ${theme}`,
      ).toEqual([]);
    }
  });
}

test("reading navigation highlights the active heading and wide tables support keyboard scrolling", async ({
  page,
  isMobile,
}) => {
  await page.goto("/posts/note-1");
  if (isMobile) await page.getByText("浏览文章目录", { exact: true }).click();
  const navigation = page
    .getByRole("navigation", { name: "文章目录", exact: true })
    .filter({ visible: true });
  const current = navigation.locator('a[aria-current="location"]');
  await expect(current).toHaveCount(1);
  const primary = await page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  await expect(current).toHaveCSS("border-left-color", primary);
  await expect(current).toHaveCSS("color", primary);

  const table = page.getByRole("region", { name: "表格，可横向滚动" });
  await table.focus();
  await expect(table).toBeFocused();
  if (isMobile) {
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  }
});
