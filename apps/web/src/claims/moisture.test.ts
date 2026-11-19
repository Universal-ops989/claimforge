import { describe, expect, test } from "vitest";

import { checkVisit, goal, latest, parseReading, reading, type AirPlace } from "./moisture";

const places: AirPlace[] = [
  { key: "outdoors", label: "Outdoors", location: "outdoors", roomId: null },
  { key: "room-1", label: "Kitchen", location: "room", roomId: "room-1" },
];
const draft = (readings: Record<string, string> = {}, air = {}, notes = "") => ({
  readings,
  air,
  notes,
});

test("readings and goals read on their scale", () => {
  expect(reading(18, "percent")).toBe("18%");
  expect(reading(18.5, "reference")).toBe("18.5");
  expect(goal({ dry_standard: 12, scale: "percent" })).toBe("12% or less");
  expect(goal({ dry_standard: null, scale: "percent" })).toBe("No goal");
});

test("latest skips visits that didn't read the point", () => {
  const point = { values: [28, 22, null] } as Parameters<typeof latest>[0];
  expect(latest(point)).toBe(22);
  expect(latest({ ...point, values: [null] })).toBeNull();
});

test("parseReading takes blanks, tenths and the range", () => {
  const range = { min: 0, max: 100 };
  expect(parseReading(" ", range)).toEqual({ value: null });
  expect(parseReading("18.5", range)).toEqual({ value: 18.5 });
  expect(parseReading("101", range)).toEqual({ problem: "Enter 0 to 100." });
  expect(parseReading("1.25", range)).toEqual({ problem: "To a tenth at most." });
});

describe("checkVisit", () => {
  test("sends what was read, leaving blanks out", () => {
    const checked = checkVisit(
      draft({ p1: "16", p2: "" }, { "room-1": { temperature: "72", humidity: "55" } }, " Fans on "),
      places,
    );

    expect(checked).toEqual({
      problems: {},
      body: {
        readings: [{ point_id: "p1", value: 16 }],
        atmosphere: [
          { location: "room", room_id: "room-1", temperature_f: 72, relative_humidity: 55 },
        ],
        notes: "Fans on",
      },
    });
  });

  test("a place needs both its temperature and humidity", () => {
    const checked = checkVisit(
      draft({}, { outdoors: { temperature: "60", humidity: "" } }),
      places,
    );

    expect(checked.problems).toEqual({ "air:outdoors:humidity": "Enter the humidity too." });
    expect(checked.body).toBeNull();
  });

  test("something must be read, and in range", () => {
    expect(checkVisit(draft({ p1: "" }), places).problems).toEqual({
      visit: "Enter at least one reading or the air.",
    });
    expect(
      checkVisit(draft({}, { outdoors: { temperature: "200", humidity: "50" } }), places).problems,
    ).toEqual({ "air:outdoors:temperature": "Enter -40 to 160." });
  });
});
