// @vitest-environment jsdom
import { cleanup, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { claimSummary, contact } from "../fixtures";
import { hasSearchWords, useSearch } from "./index";
import { FakeServer, json, ORG_ID, renderWithApi } from "./testing";

afterEach(cleanup);

const SEARCH = `/v1/organizations/${ORG_ID}/search`;

test("asks with the words typed, and finds claims and contacts", async () => {
  const server = new FakeServer().on("GET", SEARCH, () =>
    json({
      claims: [{ claim: claimSummary(), matched_in: ["contact"] }],
      contacts: [{ contact: contact() }],
    }),
  );
  const { result } = renderWithApi(() => useSearch(ORG_ID, "  jordan  ", 3), { server });

  await waitFor(() => {
    expect(result.current.data?.contacts[0]?.contact.full_name).toBe("Jordan Rivera");
  });
  expect(server.calls[0]).toContain("/search?q=jordan&limit=3");
});

test("a search without words asks nothing", async () => {
  const server = new FakeServer();
  const { result } = renderWithApi(() => useSearch(ORG_ID, " -- "), { server });

  await waitFor(() => {
    expect(result.current.fetchStatus).toBe("idle");
  });
  expect(result.current.data).toBeUndefined();
  expect(server.calls).toEqual([]);
  expect([hasSearchWords("-- "), hasSearchWords("Café")]).toEqual([false, true]);
});
