import { expect, test } from "vitest";

import { parseTags, tagsProblem, tagsText } from "./photo-tags";

test("typed tags are kept as the API keeps them", () => {
  expect(parseTags(" Before, ceiling,,  Water   Line , before")).toEqual([
    "before",
    "ceiling",
    "water line",
  ]);
  expect(parseTags("")).toEqual([]);
  expect(tagsText(["before", "ceiling"])).toBe("before, ceiling");
});

test("tags the API would refuse are pointed out", () => {
  expect(tagsProblem("before, after")).toBeNull();
  expect(tagsProblem(Array.from({ length: 21 }, (_, n) => `t${String(n)}`).join(","))).toBe(
    "Up to 20 tags.",
  );
  expect(tagsProblem("x".repeat(41))).toMatch(/^Keep each tag to 40 characters/);
  expect(tagsProblem("wet/dry")).toBe(
    `Tags start with a letter or digit and take letters, digits, spaces and hyphens ("wet/dry" doesn't).`,
  );
  expect(tagsProblem("-after")).toMatch(/^Tags start with a letter/);
  expect(tagsProblem("north-wall, room_2")).toBeNull();
});
