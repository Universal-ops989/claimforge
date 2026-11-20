// @vitest-environment jsdom
import { cleanup, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { ids, priceItem, priceList } from "../fixtures";
import { usePriceItems, usePriceLists } from "./index";
import { FakeServer, json, ORG_ID, renderWithApi } from "./testing";

afterEach(cleanup);

test("price lists, and a list's items searched", async () => {
  const LISTS = `/v1/organizations/${ORG_ID}/price-lists`;
  const server = new FakeServer()
    .on("GET", LISTS, () => json([priceList()]))
    .on("GET", `${LISTS}/${ids.priceList}/items`, () =>
      json({ items: [priceItem()], next_cursor: null, has_more: false }),
    );
  const { result } = renderWithApi(
    () => ({
      lists: usePriceLists(ORG_ID),
      items: usePriceItems(ORG_ID, ids.priceList, { q: "dehu" }),
    }),
    { server },
  );

  await waitFor(() => {
    expect(result.current.items.data?.pages[0]?.items.map((i) => i.code)).toEqual(["WTR-DEHU"]);
  });
  expect(result.current.lists.data?.[0]?.is_default).toBe(true);
  expect(server.calls.some((call) => call.includes("/items?q=dehu"))).toBe(true);
});
