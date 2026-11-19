import { fixtureId, ids, room } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const ROOMS = "/lone-star/claims/2026-00042/rooms";

type User = ReturnType<typeof userEvent.setup>;

const open = () => renderApp(ROOMS, { signedInAs: "morgan@example.com" });
const kitchenDamage = async () =>
  within(await screen.findByRole("list", { name: "Damage in the Kitchen" }));
const dialog = async () => within(await screen.findByRole("dialog"));

async function choose(user: User, field: RegExp, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function startRecording(user: User) {
  await open();
  await user.click(await screen.findByRole("button", { name: "Record damage in the Kitchen" }));
  return dialog();
}

async function material(user: User, text: string) {
  const field = screen.getByRole("textbox", { name: /^Material/ });
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

const recorded = () => backend.db.damage.map((d) => d.item);

describe("damage in a room", () => {
  test("shows what's damaged, the cause, the water's category and class, and notes", async () => {
    await open();

    const item = (await kitchenDamage()).getByRole("listitem");
    expect(item).toHaveTextContent("Floor · Laminate");
    expect(item).toHaveTextContent("Water · Category 1 (clean) · Class 2 (significant)");
    expect(item).toHaveTextContent("Swollen at the seams along the sink run");
  });

  test("recording starts from the claim's cause", async () => {
    const user = userEvent.setup();
    const form = await startRecording(user);

    await choose(user, /^What's damaged/, "Wall");
    await material(user, "Drywall");
    expect(form.getByRole("combobox", { name: /^Cause/ })).toHaveTextContent("Water");
    await choose(user, /^Water class/, "Class 3 (most)");
    await user.click(form.getByRole("button", { name: "Record damage" }));

    expect(await (await kitchenDamage()).findByText("Wall · Drywall")).toBeInTheDocument();
    expect(recorded().at(-1)).toMatchObject({
      surface: "wall",
      material: "Drywall",
      cause: "water",
      water_category: null,
      water_class: 3,
    });
  });

  test("sewage water is always Category 3, and the form says so", async () => {
    const user = userEvent.setup();
    const form = await startRecording(user);

    await choose(user, /^What's damaged/, "Floor");
    await material(user, "Carpet");
    await choose(user, /^Cause/, "Sewage");

    const category = form.getByRole("combobox", { name: /^Water category/ });
    expect(category).toHaveTextContent("Category 3 (black)");
    expect(category).toBeDisabled();
    expect(form.getByText("Flood and sewage water is always Category 3.")).toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "Record damage" }));

    await waitFor(() => {
      expect(recorded().at(-1)).toMatchObject({ cause: "sewage", water_category: 3 });
    });
  });

  test("damage that isn't water has no water details", async () => {
    const user = userEvent.setup();
    const form = await startRecording(user);

    await choose(user, /^What's damaged/, "Ceiling");
    await material(user, "Paint");
    await choose(user, /^Cause/, "Smoke");

    expect(form.queryByRole("combobox", { name: /^Water/ })).not.toBeInTheDocument();
    await user.click(form.getByRole("button", { name: "Record damage" }));

    await waitFor(() => {
      expect(recorded().at(-1)).toMatchObject({
        cause: "smoke",
        water_category: null,
        water_class: null,
      });
    });
  });

  test("asks for what's damaged and the material before asking the API", async () => {
    const user = userEvent.setup();
    const form = await startRecording(user);

    await user.click(form.getByRole("button", { name: "Record damage" }));

    expect(await form.findByText("Choose what's damaged.")).toBeInTheDocument();
    expect(form.getByText("Enter the material: drywall, carpet, laminate…")).toBeInTheDocument();
    expect(recorded()).toHaveLength(1);
  });

  test("the API's refusal shows on the field it's about", async () => {
    server.use(
      mock.post(
        "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}/damage-items",
        () => problem(422, "not_water_damage"),
      ),
    );
    const user = userEvent.setup();
    const form = await startRecording(user);

    await choose(user, /^What's damaged/, "Floor");
    await material(user, "Tile");
    await user.click(form.getByRole("button", { name: "Record damage" }));

    expect(
      await form.findByText("Water category and class only go with water damage."),
    ).toBeInTheDocument();
  });
});

describe("changing damage", () => {
  async function menu(user: User) {
    await user.click(
      (await kitchenDamage()).getByRole("button", { name: "Change the floor · laminate damage" }),
    );
    return within(await screen.findByRole("menu"));
  }

  test("editing can move it to another room", async () => {
    const house = backend.db.structures[0]?.structure;
    if (!house) throw new Error("no house");
    house.rooms.push(room({ id: fixtureId("room", 2), name: "Pantry", level: null }));
    const user = userEvent.setup();
    await open();

    await user.click((await menu(user)).getByRole("menuitem", { name: "Edit" }));
    const form = await dialog();
    await material(user, "Vinyl plank");
    await choose(user, /^Room/, "Pantry (House)");
    await user.click(form.getByRole("button", { name: "Save changes" }));

    const pantry = within(await screen.findByRole("list", { name: "Damage in the Pantry" }));
    expect(await pantry.findByText("Floor · Vinyl plank")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Damage in the Kitchen" })).not.toBeInTheDocument();
  });

  test("deleting asks first", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await menu(user)).getByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(
        await screen.findByRole("alertdialog", { name: "Delete the floor · laminate damage?" }),
      ).getByRole("button", { name: "Delete" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("list", { name: "Damage in the Kitchen" })).not.toBeInTheDocument();
    });
    expect(recorded()).toEqual([]);
  });

  test("a closed claim's damage can't change", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    await open();

    expect((await kitchenDamage()).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Record damage/ })).not.toBeInTheDocument();
  });
});
