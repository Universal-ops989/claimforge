import { describe, expect, test } from "vitest";

import { lineTotal, money, parseDecimal, percent, quantity } from "./estimates";

test("amounts read as people read them", () => {
  expect(money("1234.5")).toBe("$1,234.50");
  expect(percent("8.250")).toBe("8.25%");
  expect(quantity("24.00")).toBe("24");
  expect(quantity("2.50")).toBe("2.5");
});

describe("parseDecimal", () => {
  const price = { places: 2, max: 9_999_999_999.99, what: "unit price" };

  test("takes plain numbers, and the dollar signs and commas people type", () => {
    expect(parseDecimal("85", price)).toEqual({ value: "85" });
    expect(parseDecimal("$1,200.50", price)).toEqual({ value: "1200.50" });
    expect(parseDecimal("3.", price)).toEqual({ value: "3" });
  });

  test("says what's wrong", () => {
    expect(parseDecimal("", price)).toEqual({ problem: "Enter the unit price." });
    expect(parseDecimal("1.234", price)).toEqual({
      problem: "Enter the unit price to the hundredth at most.",
    });
    expect(parseDecimal("-2", price)).toEqual({
      problem: "Enter the unit price to the hundredth at most.",
    });
    expect(parseDecimal("101", { places: 3, max: 100, what: "tax rate" })).toEqual({
      problem: "The tax rate can be up to 100.",
    });
  });
});

test("a line's total is quantity times price, to the cent", () => {
  expect(lineTotal("24", "3.10")).toBe("74.40");
  expect(lineTotal("2.5", "28.00")).toBe("70.00");
  expect(lineTotal("1.33", "0.45")).toBe("0.60");
});
