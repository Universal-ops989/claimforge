import { expect, test } from "vitest";

import { calendarDate } from "./calendar-date";

test("reads an API date as that day, wherever the browser is", () => {
  expect(calendarDate("2026-11-10", "en-US")).toBe("Nov 10, 2026");
  expect(calendarDate("2026-01-01", "en-US")).toBe("Jan 1, 2026");
});
