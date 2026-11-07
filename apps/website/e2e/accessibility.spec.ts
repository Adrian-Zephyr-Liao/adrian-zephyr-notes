import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"]) {
  test(`${theme} reading surfaces have no detected accessibility violations`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
    for (const path of ["/", "/archives", "/categories", "/tags", "/comments", "/posts/note-1"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveClass(new RegExp(theme));
      await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
      if (path === "/posts/note-1") {
        const tables = page.locator('.markdown-table-wrap[role="region"]');
        await expect(tables).toHaveCount(4);
        const names = await tables.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("aria-label") ?? ""),
        );
        expect(new Set(names).size).toBe(4);
        names.forEach((name, index) => {
          expect(name).toContain(`表格 ${index + 1}：`);
          expect(name).toContain("阶段、验证方法、结果");
          expect(name).toContain(index < 2 ? "留下思考" : "复核结果");
          expect(Array.from(name).length).toBeLessThanOrEqual(90);
        });
      }
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

  const tables = page.getByRole("region", { name: /^表格 \d+：.*可横向滚动$/ });
  await expect(tables).toHaveCount(4);
  for (const table of await tables.all()) {
    await expect(table).toHaveAttribute("tabindex", "0");
    await table.focus();
    await expect(table).toBeFocused();
    if (isMobile) {
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => table.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    }
  }
});
