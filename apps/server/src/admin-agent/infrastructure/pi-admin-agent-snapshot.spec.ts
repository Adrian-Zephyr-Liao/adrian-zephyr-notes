import { describe, expect, it } from "vitest";
import { decodePiSnapshot, encodePiSnapshot } from "./pi-admin-agent-snapshot";

describe("Pi business snapshots", () => {
  it("preserves nested dates, arrays, and null dates across persistent JSON serialization", () => {
    const date = new Date("2026-11-05T16:00:00.000Z");
    const state = {
      comments: [{ createdAt: date }],
      article: { updatedAt: date, publishedAt: null },
      plan: [],
      summary: "ok",
    };
    const persisted = JSON.parse(JSON.stringify(encodePiSnapshot(state)));
    expect(decodePiSnapshot(persisted)).toEqual(state);
    expect(persisted.dates).toEqual([
      ["comments", "0", "createdAt"],
      ["article", "updatedAt"],
    ]);
  });

  it("does not reinterpret user JSON or ISO text as serialization tags", () => {
    const value = {
      $date: "2026-11-05T16:00:00.000Z",
      __piDate: "same",
      createdAt: "2026-11-05T16:00:00.000Z",
      nested: { type: "Date", value: "text" },
    };
    expect(encodePiSnapshot(value).dates).toEqual([]);
    expect(decodePiSnapshot(encodePiSnapshot(value))).toEqual(value);
  });

  it("keeps property names and numeric array paths distinct", () => {
    const date = new Date("2026-11-05T16:00:00.000Z");
    const value = { "a.b": date, a: { b: "unchanged" }, "0": [date] };
    expect(decodePiSnapshot(encodePiSnapshot(value))).toEqual(value);
  });

  it("does not mutate the original state or persisted snapshot while decoding", () => {
    const value = { createdAt: new Date("2026-11-05T16:00:00.000Z") };
    const snapshot = encodePiSnapshot(value);
    const original = JSON.stringify(snapshot);
    decodePiSnapshot(snapshot);
    expect(JSON.stringify(snapshot)).toBe(original);
    expect(value.createdAt).toBeInstanceOf(Date);
  });
});
