import { timelineEntry } from "@claimforge/api-client/fixtures";
import { describe, expect, test } from "vitest";

import { byDay, dayLabel, readKinds, writeKinds } from "./timeline";

describe("kinds in the address", () => {
  test("read back what was written, unknown kinds dropped, in the offered order", () => {
    const params = new URLSearchParams("kind=photos&kind=lava&kind=status&tab=x");

    const kinds = readKinds(params);

    expect(kinds).toEqual(["status", "photos"]);
    expect(writeKinds(params, kinds).toString()).toBe("tab=x&kind=status&kind=photos");
    expect(writeKinds(params, []).toString()).toBe("tab=x");
  });
});

describe("days", () => {
  const now = new Date(2026, 10, 19, 15, 0);

  test("today and yesterday by name, the rest by date", () => {
    expect(dayLabel("2026-11-19", now)).toBe("Today");
    expect(dayLabel("2026-11-18", now)).toBe("Yesterday");
    expect(dayLabel("2026-11-16", now)).toMatch(/Nov 16, 2026/);
  });

  test("entries fall into runs by the day they happened", () => {
    const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();
    const entries = [
      timelineEntry({ id: "a", at: at(19, 10) }),
      timelineEntry({ id: "b", at: at(19, 8) }),
      timelineEntry({ id: "c", at: at(16, 9) }),
    ];

    expect(byDay(entries).map((d) => [d.day, d.entries.map((e) => e.id)])).toEqual([
      ["2026-11-19", ["a", "b"]],
      ["2026-11-16", ["c"]],
    ]);
  });
});
