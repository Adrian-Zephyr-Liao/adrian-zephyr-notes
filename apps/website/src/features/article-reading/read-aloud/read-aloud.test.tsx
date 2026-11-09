// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArticleReadAloud } from ".";
import { getReadingChunks } from "./reading-text";

class Utterance {
  text: string;
  lang = "";
  rate = 1;
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

let spoken: Utterance[];
const chineseVoice = { lang: "zh-CN", name: "Chinese" };
const synth = {
  speak: vi.fn((utterance: Utterance) => {
    spoken.push(utterance);
  }),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [chineseVoice]),
};

beforeEach(() => {
  spoken = [];
  vi.clearAllMocks();
  vi.stubGlobal("speechSynthesis", synth);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(body = "<p>第一段正文。</p><p>Second paragraph.</p>") {
  const content = document.createElement("div");
  content.id = "test-content";
  content.innerHTML = body;
  document.body.append(content);
  const view = render(<ArticleReadAloud contentId="test-content" title="文章标题" />);
  return { ...view, content };
}
afterEach(() => {
  document.getElementById("test-content")?.remove();
});

describe("article read aloud", () => {
  it("waits for a click, reads every chunk in order and finishes", () => {
    mount();
    expect(synth.speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    expect(spoken[0].text).toBe("文章标题");
    expect(spoken[0].voice).toBe(chineseVoice);
    act(() => spoken[0].onend?.());
    expect(spoken[1].text).toBe("第一段正文。");
    act(() => spoken[1].onend?.());
    expect(spoken[2].text).toBe("Second paragraph.");
    expect(spoken[2].lang).toBe("en-US");
    act(() => spoken[2].onend?.());
    expect(screen.getByRole("status").textContent).toBe("全文朗读完毕。");
    fireEvent.click(screen.getByRole("button", { name: "重新朗读" }));
    expect(spoken[3].text).toBe("文章标题");
  });

  it("pauses, resumes, and applies a changed speed to the next chunk", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停朗读" }));
    expect(synth.pause).toHaveBeenCalledOnce();
    expect(screen.getByRole("status").textContent).toContain("已暂停");
    fireEvent.change(screen.getByRole("combobox", { name: "朗读语速" }), {
      target: { value: "1.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "继续朗读" }));
    expect(synth.resume).toHaveBeenCalledTimes(2);
    act(() => spoken[0].onend?.());
    expect(spoken[1].rate).toBe(1.5);
  });

  it("does not start the next chunk if an end event arrives while paused", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    fireEvent.click(screen.getByRole("button", { name: "暂停朗读" }));
    act(() => spoken[0].onend?.());
    expect(spoken).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "继续朗读" }));
    expect(spoken[1].text).toBe("第一段正文。");
  });

  it("ignores cancelled speech callbacks even after restarting", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    const cancelled = spoken[0];
    fireEvent.click(screen.getByRole("button", { name: "停止朗读" }));
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    act(() => {
      cancelled.onend?.();
      cancelled.onerror?.();
    });
    expect(spoken).toHaveLength(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "暂停朗读" })).toBeTruthy();
  });

  it("stops on unmount and prevents late callbacks from continuing", () => {
    const view = mount();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    view.unmount();
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    act(() => spoken[0].onend?.());
    expect(spoken).toHaveLength(1);
  });

  it("cancels on pagehide and resets controls on a back-forward cache restore", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    act(() => {
      window.dispatchEvent(new Event("pageshow"));
    });
    act(() => spoken[0].onend?.());
    expect(spoken).toHaveLength(1);
    expect(screen.getByRole("button", { name: "朗读全文" })).toBeTruthy();
  });

  it("shows synthesis errors and allows retry", () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    act(() => spoken[0].onerror?.());
    expect(screen.getByRole("alert").textContent).toContain("请重试");
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(spoken).toHaveLength(2);
  });

  it("handles a synchronous speech engine failure", () => {
    synth.speak.mockImplementationOnce(() => {
      throw new Error("unavailable");
    });
    mount();
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    expect(screen.getByRole("alert").textContent).toContain("无法启动朗读");
    expect(screen.getByRole("button", { name: "朗读全文" })).toBeTruthy();
  });

  it("disables controls when speech is unsupported", () => {
    vi.stubGlobal("SpeechSynthesisUtterance", undefined);
    // Feature detection uses property presence, like the browser API contract.
    Reflect.deleteProperty(window, "SpeechSynthesisUtterance");
    mount();
    expect((screen.getByRole("button", { name: "朗读全文" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole("status").textContent).toContain("不支持");
  });

  it("does not read the title alone when the article contains only code", () => {
    mount("<pre>const secret = 1;</pre>");
    fireEvent.click(screen.getByRole("button", { name: "朗读全文" }));
    expect(synth.speak).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("暂无可朗读");
  });
});

it("extracts visible prose, lists and tables without controls, code, URLs or duplicate text", () => {
  const content = document.createElement("div");
  content.innerHTML =
    '<h2>小节<a class="markdown-heading-anchor">#</a></h2><p>阅读<a href="https://example.test">链接</a>。</p><ul><li>第一项</li><li>第二项</li></ul><div data-code-copy-root><span>typescript</span><button>复制</button><pre>const x = 1</pre></div><svg><text>图表</text></svg><span hidden>隐藏</span><p aria-hidden="true">装饰</p><table><tr><td>名称</td><td>价格</td></tr></table>';
  const text = getReadingChunks(content, "标题").join("|");
  expect(text).toBe("标题|小节|阅读链接。|第一项|第二项|名称，价格，");
  expect(content.querySelector("pre")?.textContent).toBe("const x = 1");
});

it("splits long punctuation-free paragraphs without losing Unicode characters", () => {
  const content = document.createElement("div");
  const body = "长文🌏".repeat(500);
  content.textContent = body;
  const chunks = getReadingChunks(content, "标题");
  expect(chunks.slice(1).join("")).toBe(body);
  expect(chunks.every((chunk) => Array.from(chunk).length <= 160)).toBe(true);
});
