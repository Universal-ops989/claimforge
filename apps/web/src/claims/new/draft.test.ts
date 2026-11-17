import { describe, expect, test } from "vitest";

import { draftProblems, EMPTY_DRAFT, type ClaimDraft } from "./draft";

const TODAY = "2026-11-17";
const filled: ClaimDraft = {
  property: { ...EMPTY_DRAFT.property, line1: "5 Elm St", city: "Round Rock" },
  loss: { ...EMPTY_DRAFT.loss, loss_type: "water" },
};
const problems = (draft: ClaimDraft) => draftProblems(draft, TODAY, 2026);

describe("draftProblems", () => {
  test("a filled-in draft has none", () => {
    expect(problems(filled)).toEqual({});
  });

  test("asks for what the API needs", () => {
    expect(problems(EMPTY_DRAFT)).toEqual({
      "property.line1": "Enter the street address.",
      "property.city": "Enter the city.",
      "loss.loss_type": "Choose what caused the damage.",
    });
  });

  test("blank fields don't count as filled", () => {
    const blank = { ...filled, property: { ...filled.property, line1: "   " } };

    expect(problems(blank)).toHaveProperty("property.line1");
  });

  test.each(["1599", "2027", "19x0", "1999.5"])("year built %s is refused", (year) => {
    const draft = { ...filled, property: { ...filled.property, year_built: year } };

    expect(problems(draft)["property.year_built"]).toBe("Enter a year from 1600 to 2026.");
  });

  test.each(["1600", "1998", "2026", ""])("year built %j is fine", (year) => {
    const draft = { ...filled, property: { ...filled.property, year_built: year } };

    expect(problems(draft)).toEqual({});
  });

  test("the date of loss can't be after today, but can be today", () => {
    const on = (loss_date: string) => problems({ ...filled, loss: { ...filled.loss, loss_date } });

    expect(on("2026-11-18")["loss.loss_date"]).toBe("The date of loss can't be in the future.");
    expect(on(TODAY)).toEqual({});
  });

  test("keeps to the contract's lengths", () => {
    const draft = {
      property: { ...filled.property, line1: "x".repeat(201), postal_code: "1".repeat(17) },
      loss: { ...filled.loss, policy_number: "p".repeat(64) },
    };

    expect(problems(draft)).toEqual({
      "property.line1": "Keep this to 200 characters or fewer.",
      "property.postal_code": "Keep this to 16 characters or fewer.",
    });
  });
});
