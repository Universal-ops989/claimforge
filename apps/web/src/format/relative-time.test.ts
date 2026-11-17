import { describe, expect, test } from "vitest";

import { fullTime, relativeTime } from "./relative-time";

const NOW = new Date("2026-11-17T12:00:00Z");

describe("relativeTime", () => {
  test.each([
    ["2026-11-17T11:59:30Z", "just now"],
    ["2026-11-17T11:55:00Z", "5 minutes ago"],
    ["2026-11-17T09:00:00Z", "3 hours ago"],
    ["2026-11-16T12:00:00Z", "yesterday"],
    ["2026-11-13T12:00:00Z", "4 days ago"],
    ["2026-11-03T12:00:00Z", "2 weeks ago"],
    ["2026-08-17T12:00:00Z", "3 months ago"],
    ["2026-11-19T12:00:00Z", "in 2 days"],
  ])("%s is %s", (when, words) => {
    expect(relativeTime(when, NOW, "en")).toBe(words);
  });
});

test("fullTime gives the date and time", () => {
  expect(fullTime("2026-11-17T09:30:00Z", "en-US")).toMatch(/^Nov 17, 2026, \d{1,2}:30\s?(AM|PM)$/);
});
