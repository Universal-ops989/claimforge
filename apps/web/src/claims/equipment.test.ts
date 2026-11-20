import { expect, test } from "vitest";

import { capacity, days, fromLocalInput, toLocalInput } from "./equipment";

test("capacity reads with its unit, or not at all", () => {
  expect(capacity({ capacity: 145, capacity_unit: "pints_per_day" })).toBe("145 pints/day");
  expect(capacity({ capacity: 2400, capacity_unit: "cfm" })).toBe("2,400 CFM");
  expect(capacity({ capacity: null, capacity_unit: null })).toBeNull();
});

test("days count in words", () => {
  expect(days(1)).toBe("1 day");
  expect(days(3)).toBe("3 days");
});

test("a moment round-trips through a datetime-local field, to the minute", () => {
  const at = new Date(2026, 10, 16, 9, 30);

  expect(toLocalInput(at)).toBe("2026-11-16T09:30");
  expect(fromLocalInput("2026-11-16T09:30")).toBe(at.toISOString());
  expect(fromLocalInput("")).toBeNull();
  expect(fromLocalInput("not a time")).toBeNull();
});
