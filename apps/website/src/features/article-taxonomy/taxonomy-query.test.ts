import { describe, expect, it } from "vitest";
import { normalizeTaxonomyPage } from "./taxonomy-query";

describe("taxonomy pagination", () => {
  it.each([undefined, "", "0", "-1", "2.5", "1e2", "NaN", "Infinity", "10001", "9007199254740992"])(
    "uses page one for an invalid value %s",
    (value) => expect(normalizeTaxonomyPage(value)).toBe(1),
  );

  it("accepts positive safe integers and the first repeated query value", () => {
    expect(normalizeTaxonomyPage(" 12 ")).toBe(12);
    expect(normalizeTaxonomyPage(["2", "3"])).toBe(2);
  });
});
