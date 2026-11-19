import { claim } from "@claimforge/api-client/fixtures";
import { describe, expect, test } from "vitest";

import {
  draftProblems,
  EMPTY_DRAFT,
  fieldFor,
  lossOf,
  toClaimCreate,
  toClaimUpdate,
  type ClaimDraft,
} from "./draft";

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

describe("toClaimCreate", () => {
  test("sends what was entered, trimmed, and leaves blanks out", () => {
    const draft: ClaimDraft = {
      property: {
        ...EMPTY_DRAFT.property,
        line1: " 5 Elm St ",
        city: "Round Rock",
        region: "TX",
        year_built: "1998",
      },
      loss: {
        ...EMPTY_DRAFT.loss,
        loss_type: "water",
        loss_date: "2026-11-15",
        policy_number: "  ",
      },
    };

    expect(toClaimCreate(draft)).toEqual({
      loss_type: "water",
      loss_date: "2026-11-15",
      description: undefined,
      carrier_name: undefined,
      policy_number: undefined,
      carrier_claim_number: undefined,
      property: {
        address: {
          line1: "5 Elm St",
          line2: undefined,
          city: "Round Rock",
          region: "TX",
          postal_code: undefined,
        },
        property_type: "residential",
        year_built: 1998,
        access_notes: undefined,
      },
    });
    expect(JSON.parse(JSON.stringify(toClaimCreate(draft)))).not.toHaveProperty("policy_number");
  });
});

describe("fieldFor", () => {
  test.each([
    [["body", "property", "address", "postal_code"], "property.postal_code"],
    [["body", "property", "year_built"], "property.year_built"],
    [["body", "loss_date"], "loss.loss_date"],
    [["body", "carrier_claim_number"], "loss.carrier_claim_number"],
  ])("%j is %s", (loc, field) => {
    expect(fieldFor(loc)).toBe(field);
  });

  test.each([[["query", "limit"]], [["body", "contacts", 0, "role"]], [["body"]]])(
    "%j names nothing the form shows",
    (loc) => {
      expect(fieldFor(loc)).toBeNull();
    },
  );
});

describe("lossOf and toClaimUpdate", () => {
  test("a claim's loss round-trips, missing fields as blanks", () => {
    const loss = lossOf(claim({ loss_date: null, carrier_name: "Lone Star Mutual" }));

    expect(loss).toEqual({
      loss_type: "water",
      loss_date: "",
      description: "Supply line burst under the kitchen sink",
      carrier_name: "Lone Star Mutual",
      policy_number: "",
      carrier_claim_number: "",
    });
    expect(toClaimUpdate(loss)).toEqual({
      loss_type: "water",
      loss_date: null,
      description: "Supply line burst under the kitchen sink",
      carrier_name: "Lone Star Mutual",
      policy_number: null,
      carrier_claim_number: null,
    });
  });

  test("trims what's typed, and blanks clear", () => {
    const update = toClaimUpdate({
      ...lossOf(claim()),
      loss_date: "2026-11-01",
      description: "  ",
      policy_number: " HO-9 ",
    });

    expect(update).toMatchObject({
      loss_date: "2026-11-01",
      description: null,
      policy_number: "HO-9",
    });
  });
});
