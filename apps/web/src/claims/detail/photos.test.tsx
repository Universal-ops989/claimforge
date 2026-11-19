import { fixtureId, ids, photo } from "@claimforge/api-client/fixtures";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { backend, renderApp } from "../../test/render";

const PHOTOS = "/lone-star/claims/2026-00042/photos";

const open = (query = "") => renderApp(`${PHOTOS}${query}`, { signedInAs: "morgan@example.com" });
const grid = async () => within(await screen.findByRole("list", { name: "Photos" }));
const shown = async () => (await grid()).getAllByRole("img").map((img) => img.getAttribute("alt"));

/** Another photo on the claim, in no room. */
function addPhoto(n: number, changes: Parameters<typeof photo>[0] = {}) {
  backend.db.photos.push({
    claimId: ids.claim,
    photo: photo({
      id: fixtureId("photo", n),
      caption: `Photo ${String(n)}`,
      tags: [],
      ...changes,
    }),
    roomId: null,
  });
}

describe("the photos", () => {
  test("show as thumbnails with caption, room and tags", async () => {
    await open();

    const img = (await grid()).getByRole("img", { name: "Stain spreading from the vent" });
    expect(img.getAttribute("src")).toMatch(/__mock-storage\/files\//);
    expect(img.closest("figure")).toHaveTextContent("Kitchen · before · ceiling");
    expect(screen.getByText("Showing all 1 photo")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Photos" })).toHaveAttribute("aria-selected", "true");
  });

  test("none yet says what will show", async () => {
    backend.db.photos = [];
    await open();

    expect(await screen.findByText("No photos yet")).toBeInTheDocument();
  });

  test("one still being processed says so", async () => {
    addPhoto(2, { processing: "pending", thumbnail_url: null, preview_url: null });
    await open();

    expect(await (await grid()).findByText("Processing…")).toBeInTheDocument();
  });

  test("more load on request", async () => {
    for (let n = 2; n <= 30; n += 1) addPhoto(n);
    const user = userEvent.setup();
    await open();

    expect(await shown()).toHaveLength(25);
    await user.click(screen.getByRole("button", { name: "Load more photos" }));

    await waitFor(async () => {
      expect(await shown()).toHaveLength(30);
    });
  });
});

describe("filtering", () => {
  test("by room, including photos in none, kept in the address", async () => {
    addPhoto(2, { tags: ["after"] });
    const user = userEvent.setup();
    const { router } = await open();
    await grid();

    await user.click(screen.getByRole("combobox", { name: /^Room/ }));
    await user.click(await screen.findByRole("option", { name: "No room" }));

    await waitFor(async () => {
      expect(await shown()).toEqual(["Photo 2"]);
    });
    expect(router.state.location.search).toBe("?room=none");
  });

  test("by tags, a photo needing every tag chosen", async () => {
    addPhoto(2, { tags: ["before"] });
    const user = userEvent.setup();
    const { router } = await open();
    const tags = within(await screen.findByRole("group", { name: "Tags" }));

    await user.click(await tags.findByRole("button", { name: "ceiling" }));

    expect(tags.getByRole("button", { name: "ceiling" })).toHaveAttribute("aria-pressed", "true");
    await waitFor(async () => {
      expect(await shown()).toEqual(["Stain spreading from the vent"]);
    });
    expect(router.state.location.search).toBe("?tag=ceiling");
  });

  test("a linked filter opens filtered", async () => {
    addPhoto(2, { tags: ["after"] });
    await open("?tag=after");

    await waitFor(async () => {
      expect(await shown()).toEqual(["Photo 2"]);
    });
  });

  test("nothing matching says so, and shows everything again on request", async () => {
    const user = userEvent.setup();
    await open("?tag=nowhere");

    await user.click(await screen.findByRole("button", { name: "Show all photos" }));

    expect(await shown()).toEqual(["Stain spreading from the vent"]);
  });
});
