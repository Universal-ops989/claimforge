import { room } from "@claimforge/api-client/fixtures";
import { describe, expect, test } from "vitest";

import {
  emptyRoomDraft,
  roomDraftOf,
  roomMeasures,
  roomProblems,
  roomSize,
  roomTitle,
  toRoomBody,
} from "./layout";

describe("roomSize and roomMeasures", () => {
  test("read the room's size and what the API worked out", () => {
    expect(roomSize(room())).toBe("12 × 10 ft, 8 ft high");
    expect(roomMeasures(room())).toBe("120 sq ft floor · 352 sq ft walls · 960 cu ft");
  });

  test("say what's missing, or leave it out", () => {
    const unmeasured = room({
      length_ft: null,
      width_ft: null,
      height_ft: null,
      floor_area_sqft: null,
      wall_area_sqft: null,
      volume_cuft: null,
    });
    expect(roomSize(unmeasured)).toBe("Not measured");
    expect(roomMeasures(unmeasured)).toBeNull();
    expect(roomSize(room({ width_ft: null, height_ft: null }))).toBe("12 ft");
    expect(roomSize(room({ length_ft: 12.5, height_ft: null }))).toBe("12.5 × 10 ft");
  });
});

describe("room drafts", () => {
  test("round-trip a room, blanks clearing", () => {
    const draft = roomDraftOf(room({ level: null }));
    expect(draft).toMatchObject({ name: "Kitchen", level: "", length_ft: "12" });

    expect(toRoomBody({ ...draft, name: " Kitchen ", height_ft: "", width_ft: "10.25" })).toEqual({
      name: "Kitchen",
      level: null,
      length_ft: 12,
      width_ft: 10.25,
      height_ft: null,
    });
  });

  test("checks what the API would refuse", () => {
    const draft = { ...emptyRoomDraft("s"), length_ft: "0", width_ft: "abc", height_ft: "8.125" };

    expect(roomProblems(draft)).toEqual({
      name: "Enter the room's name.",
      length_ft: "Enter feet, more than 0 and up to 9,999.99.",
      width_ft: "Enter feet, more than 0 and up to 9,999.99.",
      height_ft: "Feet to the hundredth at most (12.5 for 12' 6\").",
    });
    expect(roomProblems({ ...emptyRoomDraft("s"), name: "Den", height_ft: "8.5" })).toEqual({});
  });
});

test("a level that's a number reads as one", () => {
  expect(roomTitle(room())).toBe("Kitchen · Level 1");
  expect(roomTitle(room({ level: "Basement" }))).toBe("Kitchen · Basement");
  expect(roomTitle(room({ level: null }))).toBe("Kitchen");
});
