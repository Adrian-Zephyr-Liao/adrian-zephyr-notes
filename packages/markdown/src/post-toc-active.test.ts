import { describe, expect, it } from "vitest";
import { getActiveTocHeadingId } from "./post-toc-active";

describe("getActiveTocHeadingId", () => {
  it("uses the first heading before the article reaches the reading anchor", () => {
    expect(
      getActiveTocHeadingId(
        [
          { id: "intro", top: 180 },
          { id: "details", top: 520 },
        ],
        112,
      ),
    ).toBe("intro");
  });

  it("uses the last heading that has crossed the reading anchor", () => {
    expect(
      getActiveTocHeadingId(
        [
          { id: "intro", top: -240 },
          { id: "details", top: 80 },
          { id: "summary", top: 460 },
        ],
        112,
      ),
    ).toBe("details");
  });

  it("returns null when there are no headings", () => {
    expect(getActiveTocHeadingId([], 112)).toBeNull();
  });
});
