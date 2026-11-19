import { fixtureId, ids, structure } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const ROOMS = "/lone-star/claims/2026-00042/rooms";

type User = ReturnType<typeof userEvent.setup>;

const open = (as: "morgan@example.com" | "riley@example.com" = "morgan@example.com") =>
  renderApp(ROOMS, { signedInAs: as });
const house = async () => within(await screen.findByRole("region", { name: "House" }));

async function fill(user: User, label: RegExp, text: string) {
  const field = screen.getByRole("textbox", { name: label });
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

async function menu(user: User, label: string) {
  await user.click(screen.getByRole("button", { name: label }));
  return within(await screen.findByRole("menu"));
}

describe("the layout", () => {
  test("shows each structure's rooms, sizes, and what they work out to", async () => {
    await open();

    const kitchen = (await house()).getByRole("listitem");
    expect(kitchen).toHaveTextContent("Kitchen · Level 1");
    expect(kitchen).toHaveTextContent("12 × 10 ft, 8 ft high");
    expect(kitchen).toHaveTextContent("120 sq ft floor · 352 sq ft walls · 960 cu ft");
    expect(screen.getByRole("tab", { name: "Rooms" })).toHaveAttribute("aria-selected", "true");
  });

  test("an empty layout says where to start", async () => {
    backend.db.structures = [];
    await open();

    expect(await screen.findByText("No rooms yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add structure" })).toBeInTheDocument();
  });
});

describe("structures", () => {
  test("a new one gets its card", async () => {
    const user = userEvent.setup();
    await open();
    await house();

    await user.click(screen.getByRole("button", { name: "Add structure" }));
    await fill(user, /^Name/, "Garage");
    await user.click(screen.getByRole("button", { name: "Add structure" }));

    expect(await screen.findByRole("region", { name: "Garage" })).toBeInTheDocument();
  });

  test("a name the claim has already is pointed out", async () => {
    const user = userEvent.setup();
    await open();
    await house();

    await user.click(screen.getByRole("button", { name: "Add structure" }));
    await fill(user, /^Name/, "house");
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Add structure" }),
    );

    expect(
      await screen.findByText("This claim already has a structure with that name."),
    ).toBeInTheDocument();
  });

  test("deleting one says its rooms and damage go with it", async () => {
    const user = userEvent.setup();
    await open();
    await house();

    await user.click((await menu(user, "Change House")).getByRole("menuitem", { name: "Delete" }));
    const confirm = within(await screen.findByRole("alertdialog", { name: "Delete House?" }));
    expect(
      confirm.getByText("Its 1 room goes with it, and the damage recorded in them."),
    ).toBeInTheDocument();
    await user.click(confirm.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("No rooms yet")).toBeInTheDocument();
    expect(backend.db.damage).toEqual([]);
  });
});

describe("rooms", () => {
  test("a new room shows with what its size works out to", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await house()).getByRole("button", { name: "Add room" }));
    await fill(user, /^Name/, "Pantry");
    await fill(user, /^Length/, "6");
    await fill(user, /^Width/, "5.5");
    await user.click(screen.getByRole("button", { name: "Add room" }));

    const pantry = await (await house()).findByText("Pantry");
    expect(pantry.closest("li")).toHaveTextContent("33 sq ft floor");
  });

  test("checks what it can before asking", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await house()).getByRole("button", { name: "Add room" }));
    await fill(user, /^Height/, "0");
    await user.click(screen.getByRole("button", { name: "Add room" }));

    expect(await screen.findByText("Enter the room's name.")).toBeInTheDocument();
    expect(screen.getByText("Enter feet, more than 0 and up to 9,999.99.")).toBeInTheDocument();
  });

  test("editing re-measures it, and can move it to another structure", async () => {
    backend.db.structures.push({
      claimId: ids.claim,
      structure: structure({ id: fixtureId("structure", 2), name: "Garage", rooms: [] }),
    });
    const user = userEvent.setup();
    await open();
    await house();

    await user.click(
      (await menu(user, "Change the Kitchen")).getByRole("menuitem", { name: "Edit" }),
    );
    await fill(user, /^Height/, "9");
    await user.click(screen.getByRole("combobox", { name: /^In/ }));
    await user.click(await screen.findByRole("option", { name: "Garage" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const garage = within(await screen.findByRole("region", { name: "Garage" }));
    expect(await garage.findByText("12 × 10 ft, 9 ft high")).toBeInTheDocument();
    expect((await house()).getByText("No rooms in House yet.")).toBeInTheDocument();
  });

  test("deleting one asks first, and the API's refusal is shown", async () => {
    server.use(
      mock.delete("/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}", () =>
        problem(409, "has_moisture_points"),
      ),
    );
    const user = userEvent.setup();
    await open();
    await house();

    await user.click(
      (await menu(user, "Change the Kitchen")).getByRole("menuitem", { name: "Delete" }),
    );
    const confirm = within(await screen.findByRole("alertdialog", { name: "Delete the Kitchen?" }));
    await user.click(confirm.getByRole("button", { name: "Delete" }));

    expect(await confirm.findByRole("alert")).toHaveTextContent("It has moisture points");
    await user.click(confirm.getByRole("button", { name: "Keep it" }));
    expect(await (await house()).findByText("Kitchen · Level 1")).toBeInTheDocument();
  });

  test("a deleted room goes, with its damage", async () => {
    const user = userEvent.setup();
    await open();
    await house();

    await user.click(
      (await menu(user, "Change the Kitchen")).getByRole("menuitem", { name: "Delete" }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete" }),
    );

    await waitFor(async () => {
      expect((await house()).getByText("No rooms in House yet.")).toBeInTheDocument();
    });
    expect(backend.db.damage).toEqual([]);
  });
});

describe("who can change the layout", () => {
  test("technicians can: it's field work", async () => {
    await open("riley@example.com");

    expect((await house()).getByRole("button", { name: "Add room" })).toBeInTheDocument();
  });

  test("nobody changes a closed claim's layout", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    await open();

    const card = await house();
    expect(card.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add structure" })).not.toBeInTheDocument();
  });
});
