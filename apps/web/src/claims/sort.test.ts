import { expect, test } from "vitest";

import { DEFAULT_SORT, readSort, writeSort } from "./sort";

const params = (query: string) => new URLSearchParams(query);

test("reads a sort the API has, and falls back to newest for anything else", () => {
  expect(readSort(params("sort=-updated_at"))).toBe("-updated_at");
  expect(readSort(params("sort=loss_date"))).toBe("loss_date");
  expect(readSort(params("sort=-number"))).toBe(DEFAULT_SORT);
  expect(readSort(params(""))).toBe(DEFAULT_SORT);
});

test("writes the sort next to the filters, leaving the default out", () => {
  expect(writeSort(params("status=new"), "-updated_at").toString()).toBe(
    "status=new&sort=-updated_at",
  );
  expect(writeSort(params("status=new&sort=-updated_at"), DEFAULT_SORT).toString()).toBe(
    "status=new",
  );
});
