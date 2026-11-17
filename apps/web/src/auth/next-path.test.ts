import { describe, expect, test } from "vitest";

import { loginPathFor, safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  test.each([
    ["/claims/2026-00042", "/claims/2026-00042"],
    ["/claims?status=new&q=elm#top", "/claims?status=new&q=elm#top"],
    ["/settings", "/settings"],
  ])("follows a path inside the app: %s", (raw, expected) => {
    expect(safeNextPath(raw)).toBe(expected);
  });

  test.each([
    null,
    undefined,
    "",
    "claims",
    "//evil.test/phish",
    String.raw`/\evil.test`,
    "https://evil.test/",
    "javascript:alert(1)",
    "/login",
    "/login?next=/claims",
  ])("falls back to the dashboard for %s", (raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });
});

test("loginPathFor keeps where to come back to", () => {
  expect(loginPathFor("/claims/2026-00042?tab=photos")).toBe(
    "/login?next=%2Fclaims%2F2026-00042%3Ftab%3Dphotos",
  );
  expect(loginPathFor("/")).toBe("/login");
});
