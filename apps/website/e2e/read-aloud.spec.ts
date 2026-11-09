import { expect, test } from "@playwright/test";

test("article speech controls work and stop on navigation", async ({ page }) => {
  // The real browser renders the article; the speech engine is deterministic and silent.
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak(utterance: SpeechSynthesisUtterance) {
          sessionStorage.setItem("speech-text", utterance.text);
          sessionStorage.setItem("speech-rate", String(utterance.rate));
          window.addEventListener(
            "test:speech-end",
            () => utterance.dispatchEvent(new Event("end")),
            { once: true },
          );
        },
        cancel() {
          sessionStorage.setItem(
            "speech-cancels",
            String(Number(sessionStorage.getItem("speech-cancels")) + 1),
          );
        },
        pause() {},
        resume() {},
        getVoices() {
          return [];
        },
      },
    });
  });
  await page.goto("/posts/note-1");
  const reader = page.getByRole("region", { name: "文章朗读", exact: true });
  await expect(reader.getByRole("button", { name: "朗读全文" })).toBeEnabled();
  await reader.scrollIntoViewIfNeeded();
  await page.screenshot({ path: test.info().outputPath("read-aloud.png") });
  expect(await page.evaluate(() => sessionStorage.getItem("speech-text"))).toBeNull();
  await reader.getByRole("combobox", { name: "朗读语速" }).selectOption("1.25");
  await reader.getByRole("button", { name: "朗读全文" }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("speech-text"))).toBe(
    await page.getByRole("heading", { level: 1 }).textContent(),
  );
  expect(await page.evaluate(() => sessionStorage.getItem("speech-rate"))).toBe("1.25");
  await reader.getByRole("button", { name: "暂停朗读" }).click();
  await expect(reader.getByRole("status")).toContainText("已暂停");
  await reader.getByRole("button", { name: "继续朗读" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("test:speech-end")));
  await expect(reader.getByRole("status")).toContainText("第 2 /");
  await reader.getByRole("button", { name: "停止朗读" }).click();
  await reader.getByRole("button", { name: "朗读全文" }).click();
  const before = await page.evaluate(() => Number(sessionStorage.getItem("speech-cancels")));
  await page.getByRole("link", { name: "回到文章归档" }).click();
  await expect(page).toHaveURL(/\/archives$/);
  await expect
    .poll(() => page.evaluate(() => Number(sessionStorage.getItem("speech-cancels"))))
    .toBeGreaterThan(before);
});

test("unsupported speech leaves the article readable with a clear explanation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
  });
  await page.goto("/posts/note-1");
  const reader = page.getByRole("region", { name: "文章朗读", exact: true });
  await expect(reader.getByRole("button", { name: "朗读全文" })).toBeDisabled();
  await expect(reader.getByRole("status")).toContainText("不支持语音朗读");
  await expect(page.locator("#article-content")).toBeVisible();
});
