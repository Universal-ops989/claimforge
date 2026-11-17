import { describe, expect, test } from "vitest";

import { filtersQuery, hasFilters, NO_FILTERS, readFilters, writeFilters } from "./filters";

const params = (query: string) => new URLSearchParams(query);

describe("readFilters", () => {
  test("reads repeated statuses and loss types, and the search", () => {
    expect(readFilters(params("status=new&status=on_hold&loss_type=water&q=+elm+"))).toEqual({
      status: ["new", "on_hold"],
      lossType: ["water"],
      q: "elm",
    });
  });

  test("drops values it doesn't know, so a hand-edited link can't break the query", () => {
    expect(readFilters(params("status=bogus&status=new&loss_type=lava"))).toEqual({
      status: ["new"],
      lossType: [],
      q: "",
    });
  });
});

describe("writeFilters", () => {
  test("round-trips, and keeps parameters that aren't filters", () => {
    const filters = { status: ["inspected" as const], lossType: ["fire" as const], q: "oak" };

    const written = writeFilters(params("sort=-updated_at&status=new"), filters);

    expect(written.toString()).toBe("sort=-updated_at&status=inspected&loss_type=fire&q=oak");
    expect(readFilters(written)).toEqual(filters);
  });

  test("clearing leaves only the rest", () => {
    expect(writeFilters(params("sort=loss_date&status=new&q=x"), NO_FILTERS).toString()).toBe(
      "sort=loss_date",
    );
  });
});

test("filtersQuery leaves empty filters out of the request", () => {
  expect(filtersQuery(NO_FILTERS)).toEqual({});
  expect(filtersQuery({ status: ["new"], lossType: [], q: "elm" })).toEqual({
    status: ["new"],
    q: "elm",
  });
  expect(hasFilters(NO_FILTERS)).toBe(false);
});
