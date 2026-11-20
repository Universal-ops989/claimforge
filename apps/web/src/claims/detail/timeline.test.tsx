import { ids, timelineEntry } from "@claimforge/api-client/fixtures";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { backend, renderApp } from "../../test/render";

const TIMELINE = "/lone-star/claims/2026-00042/timeline";
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

beforeEach(() => {
  const entries = [
    timelineEntry({
      id: "0198a2c4-7b1e-7cc0-8000-00001e000001",
      kind: "status",
      at: hoursAgo(30),
      summary: "Moved to inspected",
    }),
    timelineEntry({
      id: "0198a2c4-7b1e-7cc0-8000-00001e000002",
      kind: "photos",
      at: hoursAgo(1),
      summary: "Added 3 photos",
    }),
  ];
  backend.db.timeline.push(...entries.map((entry) => ({ claimId: ids.claim, entry })));
});

const summaries = async () =>
  (await within(await screen.findByRole("tabpanel")).findAllByRole("listitem")).map(
    (item) => item.textContent,
  );

describe("the timeline", () => {
  test("falls into days, each entry with its kind", async () => {
    await renderApp(TIMELINE, { signedInAs: "morgan@example.com" });

    const days = await screen.findAllByRole("heading", { level: 2 });
    expect(days.map((d) => d.textContent)).toEqual(expect.arrayContaining(["Today"]));
    const today = within(screen.getByRole("region", { name: "Today" }));
    expect(today.getByRole("listitem")).toHaveTextContent("Added 3 photos");
    expect(today.getByText("Photos")).toBeInTheDocument();
  });

  test("filters by kind, the filter in the address", async () => {
    const user = userEvent.setup();
    const { router } = await renderApp(TIMELINE, { signedInAs: "morgan@example.com" });
    const filters = within(await screen.findByRole("group", { name: "Show" }));

    await user.click(filters.getByRole("button", { name: "Status" }));

    expect(filters.getByRole("button", { name: "Status" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(async () => {
      expect(await summaries()).toEqual([expect.stringContaining("Moved to inspected")]);
    });
    expect(router.state.location.search).toBe("?kind=status");
  });

  test("a linked filter opens filtered, and an empty one offers everything", async () => {
    const user = userEvent.setup();
    await renderApp(`${TIMELINE}?kind=notes`, { signedInAs: "morgan@example.com" });

    expect(await screen.findByText("Nothing of that kind")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show everything" }));

    await waitFor(async () => {
      expect(await summaries()).toHaveLength(2);
    });
  });
});
