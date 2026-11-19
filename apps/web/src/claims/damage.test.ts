import { damageItem } from "@claimforge/api-client/fixtures";
import { describe, expect, test } from "vitest";

import {
  damageDetails,
  damageDraftOf,
  damageProblems,
  damageTitle,
  emptyDamageDraft,
  toDamageBody,
} from "./damage";

describe("reading damage", () => {
  test("says what's damaged, the cause, and the water's category and class", () => {
    expect(damageTitle(damageItem())).toBe("Floor · Laminate");
    expect(damageDetails(damageItem())).toBe("Water · Category 1 (clean) · Class 2 (significant)");
    expect(
      damageDetails(damageItem({ cause: "fire", water_category: null, water_class: null })),
    ).toBe("Fire");
  });
});

describe("damage drafts", () => {
  test("start from the claim's cause; flood and sewage start as Category 3", () => {
    expect(emptyDamageDraft("r", "water").water_category).toBe("");
    expect(emptyDamageDraft("r", "sewage").water_category).toBe("3");
  });

  test("round-trip an item", () => {
    expect(toDamageBody(damageDraftOf(damageItem()))).toEqual({
      surface: "floor",
      material: "Laminate",
      cause: "water",
      water_category: 1,
      water_class: 2,
      description: "Swollen at the seams along the sink run",
    });
  });

  test("send water details only with a water cause, and flood as Category 3", () => {
    const draft = damageDraftOf(damageItem());

    expect(toDamageBody({ ...draft, cause: "fire" })).toMatchObject({
      water_category: null,
      water_class: null,
    });
    expect(toDamageBody({ ...draft, cause: "flood" })).toMatchObject({
      water_category: 3,
      water_class: 2,
    });
    expect(toDamageBody({ ...draft, water_class: "", description: "  " })).toMatchObject({
      water_class: null,
      description: null,
    });
  });

  test("check what the API would refuse", () => {
    expect(damageProblems(emptyDamageDraft("r", "water"))).toEqual({
      surface: "Choose what's damaged.",
      material: "Enter the material: drywall, carpet, laminate…",
    });
    expect(damageProblems(damageDraftOf(damageItem()))).toEqual({});
  });
});
