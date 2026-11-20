import { share } from "@claimforge/api-client/fixtures";
import { expect, test } from "vitest";

import { fileSize, shareState } from "./reports";

test("sizes read as people read them", () => {
  expect(fileSize(200)).toBe("1 KB");
  expect(fileSize(840 * 1024)).toBe("840 KB");
  expect(fileSize(1_240_000)).toBe("1.2 MB");
});

test("a link works until it expires or is revoked", () => {
  const now = new Date("2026-11-20T12:00:00Z");

  expect(shareState(share({ expires_at: "2026-11-23T12:00:00Z" }), now)).toBe("active");
  expect(shareState(share({ expires_at: "2026-11-19T12:00:00Z" }), now)).toBe("expired");
  expect(shareState(share({ revoked_at: "2026-11-18T12:00:00Z" }), now)).toBe("revoked");
});
