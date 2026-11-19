import { fixtureId, ids, photo } from "@claimforge/api-client/fixtures";
import { screen, waitFor, within, type BoundFunctions, type queries } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";

import { backend, renderApp } from "../../test/render";

const PHOTOS = "/lone-star/claims/2026-00042/photos";
const SECOND = fixtureId("photo", 2);

type User = ReturnType<typeof userEvent.setup>;
type View = BoundFunctions<typeof queries>;

// Newest first: "Photo 2", then the seeded "Stain spreading from the vent".
beforeEach(() => {
  backend.db.photos.push({
    claimId: ids.claim,
    photo: photo({ id: SECOND, caption: "Photo 2", tags: ["after"] }),
    roomId: null,
  });
});

const open = (query = "", as: "morgan@example.com" | "riley@example.com" = "morgan@example.com") =>
  renderApp(`${PHOTOS}${query}`, { signedInAs: as });
const viewer = async () => within(await screen.findByRole("dialog"));
const titled = (name: string) => screen.findByRole("dialog", { name });

async function openPhoto(user: User, name: string) {
  await user.click(await screen.findByRole("button", { name: `Open ${name}` }));
  return viewer();
}

/** The viewer's fact for `term`. */
function fact(view: View, term: string) {
  const terms = view.getAllByRole("term");
  const index = terms.findIndex((t) => t.textContent === term);
  return view.getAllByRole("definition")[index]?.textContent;
}

describe("the full-size view", () => {
  test("opens on the photo chosen, with its details, and in the address", async () => {
    const user = userEvent.setup();
    const { router } = await open();

    const view = await openPhoto(user, "Stain spreading from the vent");

    expect(view.getByRole("img", { name: "Stain spreading from the vent" })).toBeInTheDocument();
    expect(view.getByText("2 of 2")).toBeInTheDocument();
    expect(fact(view, "Room")).toBe("Kitchen");
    expect(fact(view, "Tags")).toBe("before, ceiling");
    expect(fact(view, "Added")).toMatch(/by Riley Tech$/);
    expect(view.getByRole("link", { name: "Download original" })).toHaveAttribute(
      "href",
      expect.stringContaining("download=1"),
    );
    expect(router.state.location.search).toBe(`?photo=${ids.photo}`);
  });

  test("steps through the photos, by button and arrow key", async () => {
    const user = userEvent.setup();
    await open();
    const view = await openPhoto(user, "Photo 2");
    expect(view.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(view.getByRole("button", { name: "Next" }));
    expect(await titled("Stain spreading from the vent")).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(await titled("Photo 2")).toBeInTheDocument();
  });

  test("Back closes it", async () => {
    const user = userEvent.setup();
    const { router } = await open();
    await openPhoto(user, "Photo 2");

    await router.navigate(-1);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  test("a linked photo opens", async () => {
    await open(`?photo=${SECOND}`);
    expect(await titled("Photo 2")).toBeInTheDocument();
  });

  test("a link to a photo that's gone says so", async () => {
    await open(`?photo=${fixtureId("photo", 9)}`);

    expect(
      await (await viewer()).findByText("This photo isn't on the claim any more."),
    ).toBeInTheDocument();
  });
});

describe("changing a photo", () => {
  async function editing(user: User) {
    await open();
    const view = await openPhoto(user, "Stain spreading from the vent");
    await user.click(view.getByRole("button", { name: "Edit details" }));
    return view;
  }

  async function replace(user: User, view: View, label: RegExp, text: string) {
    const field = view.getByRole("textbox", { name: label });
    await user.clear(field);
    await user.click(field);
    await user.paste(text);
  }

  test("caption, tags and room are saved, tags tidied", async () => {
    const user = userEvent.setup();
    const view = await editing(user);

    await replace(user, view, /^Caption/, "Stain, day 2");
    await replace(user, view, /^Tags/, "After, water  line, after");
    await user.click(view.getByRole("combobox", { name: /^Room/ }));
    await user.click(await screen.findByRole("option", { name: "No room" }));
    await user.click(view.getByRole("button", { name: "Save changes" }));

    expect(await titled("Stain, day 2")).toBeInTheDocument();
    const saved = backend.db.photos.find((p) => p.photo.id === ids.photo);
    expect(saved?.photo.tags).toEqual(["after", "water line"]);
    expect(saved?.roomId).toBeNull();
  });

  test("tags the API would refuse are pointed out, and arrow keys stay in the field", async () => {
    const user = userEvent.setup();
    const view = await editing(user);

    await replace(user, view, /^Tags/, "wet/dry");
    await user.keyboard("{ArrowLeft}");
    await user.click(view.getByRole("button", { name: "Save changes" }));

    expect(await view.findByText(/"wet\/dry" doesn't/)).toBeInTheDocument();
    expect(
      screen.getByRole("dialog", { name: "Stain spreading from the vent" }),
    ).toBeInTheDocument();
  });

  test("deleting asks first, then shows the next photo along", async () => {
    const user = userEvent.setup();
    await open();
    const view = await openPhoto(user, "Photo 2");

    await user.click(view.getByRole("button", { name: "Delete" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Delete this photo?" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );

    expect(await titled("Stain spreading from the vent")).toBeInTheDocument();
    expect(backend.db.photos.map((p) => p.photo.id)).toEqual([ids.photo]);
  });

  test("technicians can change photos: it's field work", async () => {
    const user = userEvent.setup();
    await open("", "riley@example.com");
    expect(
      (await openPhoto(user, "Photo 2")).getByRole("button", { name: "Edit details" }),
    ).toBeInTheDocument();
  });

  test("a closed claim's photos can only be looked at", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    const user = userEvent.setup();
    await open();

    const view = await openPhoto(user, "Photo 2");

    expect(view.queryByRole("button", { name: "Edit details" })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });
});
