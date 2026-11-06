import { describe, expect, it } from "vitest";
import { getNextTypedLength } from "./use-typewriter-text";

describe("getNextTypedLength", () => {
  it("advances by one character until the full text is visible", () => {
    expect(getNextTypedLength(0, 3)).toBe(1);
    expect(getNextTypedLength(2, 3)).toBe(3);
    expect(getNextTypedLength(3, 3)).toBe(3);
  });
});
