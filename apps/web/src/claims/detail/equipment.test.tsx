import { fixtureId, ids, room } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../../test/render";

const mock = mockApi(API_URL);
const EQUIPMENT = "/lone-star/claims/2026-00042/equipment";

type User = ReturnType<typeof userEvent.setup>;

const open = (as: "morgan@example.com" | "riley@example.com" = "morgan@example.com") =>
  renderApp(EQUIPMENT, { signedInAs: as });
const onSite = async () => within(await screen.findByRole("list", { name: "On site now" }));
const tags = async () =>
  (await onSite()).getAllByRole("listitem").map((li) => li.textContent.split(" · ")[0]);
const placementOf = (tag: string) => {
  const unit = backend.db.equipment.find((e) => e.unit.asset_tag === tag)?.unit;
  return backend.db.placements.find((p) => p.equipmentId === unit?.id);
};

async function choose(user: User, field: RegExp, option: string | RegExp) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

async function menu(user: User, tag: string, item: string) {
  await user.click(await screen.findByRole("button", { name: `Change ${tag}` }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("the equipment on site", () => {
  test("lists each running unit, its room and days so far", async () => {
    await open();

    expect(await tags()).toEqual(["DH-01", "AM-01"]);
    const dehumidifier = (await onSite()).getAllByRole("listitem")[0];
    expect(dehumidifier).toHaveTextContent("Dehumidifier · Kitchen");
    expect(dehumidifier).toHaveTextContent(/days? so far/);
  });

  test("billable days add up by kind", async () => {
    await open();

    const table = within(await screen.findByRole("region", { name: "Billable days" }));
    const rows = (await table.findAllByRole("row")).slice(1);
    const cells = rows.map((row) =>
      Array.from(row.querySelectorAll("th, td"), (cell) => cell.textContent),
    );
    // Kind, placements, running; the days depend on today's date.
    expect(cells.map((row) => row.slice(0, 3))).toEqual([
      ["Dehumidifier", "1", "1"],
      ["Air mover", "1", "1"],
    ]);
    expect(Number(cells[0]?.[3])).toBeGreaterThanOrEqual(3);
  });

  test("nothing running says what to do", async () => {
    backend.db.placements = [];
    await open();

    expect(await screen.findByText("Nothing running")).toBeInTheDocument();
  });
});

describe("placing equipment", () => {
  test("offers only free units, and the placed one joins the list", async () => {
    const user = userEvent.setup();
    await open();
    await onSite();

    await user.click(screen.getByRole("button", { name: "Place equipment" }));
    await user.click(await screen.findByRole("combobox", { name: /^Unit/ }));
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
      "AM-02 · Air mover · 2,400 CFM",
    ]);
    await user.click(screen.getByRole("option", { name: /^AM-02/ }));
    await choose(user, /^Room/, "Kitchen");
    await user.click(screen.getByRole("button", { name: "Place" }));

    await waitFor(async () => {
      expect(await tags()).toEqual(["DH-01", "AM-01", "AM-02"]);
    });
    expect(placementOf("AM-02")).toMatchObject({ roomId: ids.room, removed_at: null });
  });

  test("asks for the unit and room, and refuses a time in the future", async () => {
    const user = userEvent.setup();
    await open();
    await onSite();

    await user.click(screen.getByRole("button", { name: "Place equipment" }));
    const form = within(await screen.findByRole("dialog"));
    fireEvent.change(form.getByLabelText(/^Placed/), { target: { value: "2099-01-01T08:00" } });
    await user.click(form.getByRole("button", { name: "Place" }));

    expect(await form.findByText("Choose a unit.")).toBeInTheDocument();
    expect(form.getByText("Choose the room.")).toBeInTheDocument();
    expect(form.getByText("That's in the future.")).toBeInTheDocument();
  });

  test("the API's refusal is told in words", async () => {
    server.use(
      mock.post("/v1/organizations/{organization_id}/claims/{claim_id}/equipment-placements", () =>
        problem(409, "equipment_running"),
      ),
    );
    const user = userEvent.setup();
    await open();
    await onSite();

    await user.click(screen.getByRole("button", { name: "Place equipment" }));
    await choose(user, /^Unit/, /^AM-02/);
    await choose(user, /^Room/, "Kitchen");
    await user.click(screen.getByRole("button", { name: "Place" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That unit is running on another job.",
    );
  });
});

describe("changing a placement", () => {
  test("removing a unit moves it to the history", async () => {
    const user = userEvent.setup();
    await open();

    await menu(user, "DH-01", "Remove");
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }),
    );

    const removed = within(await screen.findByRole("list", { name: "Removed" }));
    expect(removed.getByText("DH-01 · LGR dehumidifier")).toBeInTheDocument();
    expect(await tags()).toEqual(["AM-01"]);
    expect(placementOf("DH-01")?.removed_at).not.toBeNull();
  });

  test("moving a unit to another room", async () => {
    backend.db.structures[0]?.structure.rooms.push(
      room({ id: fixtureId("room", 2), name: "Pantry", level: null }),
    );
    const user = userEvent.setup();
    await open();

    await menu(user, "DH-01", "Move or correct");
    await choose(user, /^Room/, "Pantry");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(async () => {
      expect((await onSite()).getAllByRole("listitem")[0]).toHaveTextContent("Pantry");
    });
  });

  test("a correction can't have a unit come out before it went in", async () => {
    const placed = placementOf("DH-01");
    if (placed) placed.removed_at = "2026-11-15T16:00:00.000Z";
    const user = userEvent.setup();
    await open();
    await screen.findByRole("list", { name: "Removed" });

    await menu(user, "DH-01", "Correct");
    const form = within(await screen.findByRole("dialog"));
    fireEvent.change(form.getByLabelText(/^Removed/), { target: { value: "2026-11-01T08:00" } });
    await user.click(form.getByRole("button", { name: "Save changes" }));

    expect(await form.findByText("It can't come out before it went in.")).toBeInTheDocument();
  });

  test("deleting a placement asks first, and says it's for mistakes", async () => {
    const user = userEvent.setup();
    await open();

    await menu(user, "AM-01", "Delete");
    const confirm = within(
      await screen.findByRole("alertdialog", { name: "Delete this placement of AM-01?" }),
    );
    expect(confirm.getByText(/Only for one entered by mistake/)).toBeInTheDocument();
    await user.click(confirm.getByRole("button", { name: "Delete" }));

    await waitFor(async () => {
      expect(await tags()).toEqual(["DH-01"]);
    });
  });
});

describe("who can do what", () => {
  test("technicians place equipment: it's field work", async () => {
    await open("riley@example.com");

    expect(await screen.findByRole("button", { name: "Place equipment" })).toBeInTheDocument();
  });

  test("on a closed claim units can still be removed, and nothing else", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    const user = userEvent.setup();
    await open();
    await onSite();

    expect(screen.queryByRole("button", { name: "Place equipment" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Change DH-01" }));
    expect((await screen.findAllByRole("menuitem")).map((m) => m.textContent)).toEqual(["Remove"]);
  });
});
