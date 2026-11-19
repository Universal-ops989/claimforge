import { ApiError, UploadError } from "@claimforge/api-client";
import { describe, expect, test } from "vitest";

import { eachAtMost, photoType, uploadFailure } from "./photo-upload";

describe("photoType", () => {
  test("trusts the browser's type when it gives one the API takes", () => {
    expect(photoType({ name: "a.jpg", type: "image/jpeg" })).toBe("image/jpeg");
    expect(photoType({ name: "a.gif", type: "image/gif" })).toBeNull();
  });

  test("reads the name when the browser leaves the type blank", () => {
    expect(photoType({ name: "IMG_0001.HEIC", type: "" })).toBe("image/heic");
    expect(photoType({ name: "notes.txt", type: "" })).toBeNull();
    expect(photoType({ name: "no-extension", type: "" })).toBeNull();
  });
});

test("uploadFailure says why in words", () => {
  const problem = (code: string, status: number) =>
    new ApiError({ type: "about:blank", title: "x", status, code, detail: "x", instance: "/" });

  expect(uploadFailure(problem("photo_too_large", 422))).toBe("It's over 25 MB.");
  expect(uploadFailure(new UploadError("invalid", "x"))).toBe(
    "This file can't be uploaded as a photo.",
  );
  expect(uploadFailure(new UploadError("unreachable", "x"))).toBe(
    "The file couldn't be sent. Try again.",
  );
});

test("eachAtMost keeps no more than the limit going at once, and does them all", async () => {
  let running = 0;
  let most = 0;
  const done: number[] = [];

  await eachAtMost([1, 2, 3, 4, 5], 2, async (n) => {
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    done.push(n);
    running -= 1;
  });

  expect(most).toBe(2);
  expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
});
