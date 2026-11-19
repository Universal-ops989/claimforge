import { ids } from "@claimforge/api-client/fixtures";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const PHOTOS = "/lone-star/claims/2026-00042/photos";

const open = (query = "") => renderApp(`${PHOTOS}${query}`, { signedInAs: "morgan@example.com" });
const input = () => screen.findByTestId<HTMLInputElement>("file-input");
const uploads = async () => within(await screen.findByRole("list", { name: "Uploads" }));
const jpeg = (name: string, size = 300) =>
  new File([new Uint8Array(size)], name, { type: "image/jpeg" });
/** The photos the backend has, other than the seeded one. */
const added = () => backend.db.photos.filter((p) => p.photo.id !== ids.photo);

describe("uploading photos", () => {
  test("each goes up, says so, and joins the grid", async () => {
    const user = userEvent.setup();
    await open();

    await user.upload(await input(), [jpeg("IMG_1.jpg"), jpeg("IMG_2.jpg")]);

    await waitFor(async () => {
      expect((await uploads()).getAllByText("Added")).toHaveLength(2);
    });
    expect(screen.getByText("2 of 2 added")).toBeInTheDocument();
    const grid = within(await screen.findByRole("list", { name: "Photos" }));
    expect(await grid.findByRole("img", { name: "IMG_2.jpg" })).toBeInTheDocument();
    expect(added().map((p) => p.roomId)).toEqual([null, null]);
  });

  test("they go in the room chosen", async () => {
    const user = userEvent.setup();
    await open();

    await user.click(await screen.findByRole("combobox", { name: /^Put new photos in/ }));
    await user.click(await screen.findByRole("option", { name: "Kitchen" }));
    await user.upload(await input(), [jpeg("IMG_3.jpg")]);

    await waitFor(() => {
      expect(added().map((p) => p.roomId)).toEqual([ids.room]);
    });
  });

  test("the room being viewed is where they go, unless changed", async () => {
    await open(`?room=${ids.room}`);

    const where = await screen.findByRole("combobox", { name: /^Put new photos in/ });
    // Once the layout is in, the room shows by name.
    await waitFor(() => {
      expect(where).toHaveTextContent("Kitchen");
    });
  });

  test("a HEIC the browser gives no type to is sent as HEIC", async () => {
    const user = userEvent.setup();
    await open();

    await user.upload(await input(), [new File([new Uint8Array(200)], "IMG_4.HEIC", { type: "" })]);

    await waitFor(() => {
      expect(added()[0]?.photo.content_type).toBe("image/heic");
    });
  });

  test("files that aren't photos, or are too big, are refused before sending", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await open();
    const big = jpeg("huge.jpg");
    Object.defineProperty(big, "size", { value: 26 * 1024 * 1024 });

    await user.upload(await input(), [new File(["x"], "notes.txt", { type: "text/plain" }), big]);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("notes.txt isn't a supported file type");
    expect(alert).toHaveTextContent(/huge\.jpg is larger than 25/);
    expect(added()).toEqual([]);
  });

  test("a file named like a photo that isn't one is caught too", async () => {
    const user = userEvent.setup();
    await open();

    await user.upload(await input(), [new File(["x"], "fake.jpg", { type: "image/gif" })]);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "fake.jpg: not a photo the claim can take.",
    );
    expect(added()).toEqual([]);
  });

  test("a failed photo says why, and goes up when tried again", async () => {
    server.use(
      http.post(
        `${API_URL}/v1/organizations/:org/claims/:claim/photo-uploads`,
        () =>
          HttpResponse.json(
            {
              type: "about:blank",
              title: "Photo too large",
              status: 422,
              code: "photo_too_large",
              detail: "Too big",
              instance: "/",
            },
            { status: 422, headers: { "Content-Type": "application/problem+json" } },
          ),
        { once: true },
      ),
    );
    const user = userEvent.setup();
    await open();

    await user.upload(await input(), [jpeg("IMG_5.jpg")]);

    const list = await uploads();
    expect(await list.findByText("It's over 25 MB.")).toBeInTheDocument();
    await user.click(list.getByRole("button", { name: "Try IMG_5.jpg again" }));

    expect(await list.findByText("Added")).toBeInTheDocument();
    expect(added()).toHaveLength(1);
  });

  test("finished uploads can be cleared", async () => {
    const user = userEvent.setup();
    await open();

    await user.upload(await input(), [jpeg("IMG_6.jpg")]);
    await user.click(await screen.findByRole("button", { name: "Clear finished" }));

    expect(screen.queryByRole("list", { name: "Uploads" })).not.toBeInTheDocument();
  });
});

describe("who can upload", () => {
  test("technicians can: it's field work", async () => {
    await renderApp(PHOTOS, { signedInAs: "riley@example.com" });

    expect(await screen.findByText("Drop photos here")).toBeInTheDocument();
  });

  test("nobody adds photos to a closed claim", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    await open();

    await screen.findByRole("list", { name: "Photos" });
    expect(screen.queryByText("Drop photos here")).not.toBeInTheDocument();
  });
});
