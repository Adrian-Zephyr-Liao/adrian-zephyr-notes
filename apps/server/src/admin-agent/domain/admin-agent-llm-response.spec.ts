import { describe, expect, it } from "vitest";
import {
  extractLlmJsonObject,
  normalizeLlmStringList,
  normalizeLlmText,
} from "./admin-agent-llm-response";

describe("admin agent LLM response helpers", () => {
  it("extracts a JSON object from raw or surrounded LLM text", () => {
    expect(extractLlmJsonObject('{"ok":true}', "Test")).toBe('{"ok":true}');
    expect(extractLlmJsonObject('Here:\n{"ok":true}\nDone', "Test")).toBe('{"ok":true}');
  });

  it("throws when no JSON object exists", () => {
    expect(() => extractLlmJsonObject("no json", "Test")).toThrow(
      "Test response did not contain JSON.",
    );
  });

  it("normalizes bounded string lists", () => {
    expect(normalizeLlmStringList(["  first  ", 1, "second value", "third"], 2, 6)).toEqual([
      "first",
      "second",
    ]);
  });

  it("normalizes bounded text with fallback", () => {
    expect(normalizeLlmText("  hello world  ", "fallback", 5)).toBe("hello");
    expect(normalizeLlmText("   ", "fallback", 5)).toBe("fallback");
    expect(normalizeLlmText(null, "fallback", 5)).toBe("fallback");
  });
});
