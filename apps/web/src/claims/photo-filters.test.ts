import { describe, expect, test } from "vitest";

import {
  hasPhotoFilters,
  NO_PHOTO_FILTERS,
  photoFiltersQuery,
  readPhotoFilters,
  toggleTag,
  writePhotoFilters,
} from "./photo-filters";

describe("photo filters in the address", () => {
  test("read back what was written, tags tidied", () => {
    const params = new URLSearchParams("room=r1&tag=Ceiling&tag=before&tag=before&tab=x");

    const filters = readPhotoFilters(params);

    expect(filters).toEqual({ room: "r1", tags: ["before", "ceiling"] });
    expect(writePhotoFilters(params, filters).toString()).toBe(
      "tab=x&room=r1&tag=before&tag=ceiling",
    );
    expect(writePhotoFilters(params, NO_PHOTO_FILTERS).toString()).toBe("tab=x");
  });

  test("an empty address is no filter", () => {
    expect(readPhotoFilters(new URLSearchParams("room="))).toEqual(NO_PHOTO_FILTERS);
    expect(hasPhotoFilters(NO_PHOTO_FILTERS)).toBe(false);
  });
});

describe("photoFiltersQuery", () => {
  test("asks for a room's photos, those in none, and every tag", () => {
    expect(photoFiltersQuery({ room: "r1", tags: [] })).toEqual({ room_id: "r1" });
    expect(photoFiltersQuery({ room: "none", tags: ["after"] })).toEqual({
      unassigned: true,
      tag: ["after"],
    });
    expect(photoFiltersQuery(NO_PHOTO_FILTERS)).toEqual({});
  });
});

test("toggleTag turns a tag on and off, keeping them in order", () => {
  const on = toggleTag({ room: null, tags: ["ceiling"] }, "before");

  expect(on.tags).toEqual(["before", "ceiling"]);
  expect(toggleTag(on, "ceiling").tags).toEqual(["before"]);
});
