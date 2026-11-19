import { ids } from "@claimforge/api-client/fixtures";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { backend, renderApp } from "../../test/render";

const MOISTURE = "/lone-star/claims/2026-00042/moisture";

type User = ReturnType<typeof userEvent.setup>;

const open = (as: "morgan@example.com" | "riley@example.com" = "morgan@example.com") =>
  renderApp(MOISTURE, { signedInAs: as });
const status = async () => within(await screen.findByRole("region", { name: "Drying status" }));
const kitchen = async () =>
  within(await screen.findByRole("list", { name: "Moisture points in the Kitchen" }));
const dialog = async () => within(await screen.findByRole("dialog"));

async function type(user: User, label: RegExp | string, text: string) {
  const field = screen.getByRole("textbox", { name: label });
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

async function choose(user: User, field: RegExp, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

describe("drying status", () => {
  test("counts the points and says what needs attention", async () => {
    await open();

    const card = await status();
    expect(await card.findByText("0 of 1 dry · 1 drying")).toBeInTheDocument();
    expect(card.getByText(/^Last visit /)).toBeInTheDocument();
    // The seeded visits are days old: a gap in monitoring.
    expect(card.getByRole("list", { name: "Needs attention" })).toHaveTextContent(
      /1 point\(s\) still drying, last read \d+ hours ago/,
    );
  });
});

describe("the points", () => {
  test("show by room with their goal, latest reading and state", async () => {
    await open();

    const point = (await kitchen()).getByRole("listitem");
    expect(point).toHaveTextContent("Point 1");
    expect(point).toHaveTextContent("Drying");
    expect(point).toHaveTextContent("drywall · Wall · goal 12% or less");
    expect(point).toHaveTextContent("Latest 18%");
  });

  test("none yet says what they're for", async () => {
    backend.db.moisturePoints = [];
    await open();

    expect(await screen.findByText("No moisture points yet")).toBeInTheDocument();
  });

  test("a new point is mapped, numbered on", async () => {
    const user = userEvent.setup();
    await open();
    await kitchen();

    await user.click(screen.getByRole("button", { name: "Map a point" }));
    await dialog();
    await choose(user, /^Room/, "Kitchen");
    await type(user, /^Material/, "Subfloor");
    await choose(user, /^Surface/, "Floor");
    await type(user, /^Dry standard/, "15");
    await user.click(screen.getByRole("button", { name: "Map point" }));

    expect(await (await kitchen()).findByText("Point 2")).toBeInTheDocument();
    const point = backend.db.moisturePoints.find((p) => p.point.label === "2")?.point;
    expect(point).toMatchObject({
      material: "Subfloor",
      dry_standard: 15,
      dry_standard_basis: "manual",
    });
  });

  test("mapping asks for the room, material and surface first", async () => {
    const user = userEvent.setup();
    await open();
    await kitchen();

    await user.click(screen.getByRole("button", { name: "Map a point" }));
    await user.click(await screen.findByRole("button", { name: "Map point" }));

    const form = await dialog();
    expect(form.getByText("Choose the room.")).toBeInTheDocument();
    expect(form.getByText("Enter the material: drywall, subfloor…")).toBeInTheDocument();
    expect(form.getByText("Choose the surface.")).toBeInTheDocument();
  });

  test("raising a point's goal can make it dry", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await kitchen()).getByRole("button", { name: "Change point 1" }));
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    await type(user, /^Dry standard/, "20");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await (await kitchen()).findByText("Dry")).toBeInTheDocument();
    expect(await (await status()).findByText("The point is dry.")).toBeInTheDocument();
  });

  test("deleting a point asks first, and takes its readings", async () => {
    const user = userEvent.setup();
    await open();

    await user.click((await kitchen()).getByRole("button", { name: "Change point 1" }));
    await user.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await user.click(
      within(await screen.findByRole("alertdialog", { name: "Delete point 1?" })).getByRole(
        "button",
        { name: "Delete" },
      ),
    );

    expect(await screen.findByText("No moisture points yet")).toBeInTheDocument();
    expect(backend.db.moistureLogs.flatMap((l) => l.readings)).toEqual([]);
  });
});

describe("logging a visit", () => {
  test("records the readings and the air, and the status follows", async () => {
    const user = userEvent.setup();
    await open();
    await kitchen();

    await user.click(screen.getByRole("button", { name: "Log a visit" }));
    await dialog();
    await type(user, /^Point 1/, "11.5");
    await type(user, /^Kitchen temperature/, "72");
    await type(user, /^Kitchen humidity/, "45");
    await user.click(screen.getByRole("button", { name: "Save visit" }));

    expect(await (await status()).findByText("The point is dry.")).toBeInTheDocument();
    expect((await kitchen()).getByRole("listitem")).toHaveTextContent("Latest 11.5%");
    const visit = backend.db.moistureLogs.at(-1);
    expect(visit?.readings).toEqual([{ point_id: ids.point, value: 11.5 }]);
    expect(visit?.atmosphere).toEqual([
      { location: "room", room_id: ids.room, temperature_f: 72, relative_humidity: 45 },
    ]);
  });

  test("checks the readings before sending", async () => {
    const user = userEvent.setup();
    await open();
    await kitchen();

    await user.click(screen.getByRole("button", { name: "Log a visit" }));
    const form = await dialog();
    await user.click(screen.getByRole("button", { name: "Save visit" }));
    expect(await form.findByRole("alert")).toHaveTextContent(
      "Enter at least one reading or the air.",
    );

    await type(user, /^Outdoors temperature/, "60");
    await user.click(screen.getByRole("button", { name: "Save visit" }));
    expect(await form.findByText("Enter the humidity too.")).toBeInTheDocument();
    expect(backend.db.moistureLogs).toHaveLength(3);
  });
});

describe("who can record moisture", () => {
  test("technicians can: it's field work", async () => {
    await open("riley@example.com");

    expect(await screen.findByRole("button", { name: "Log a visit" })).toBeInTheDocument();
  });

  test("nobody records on a closed claim", async () => {
    const claim = backend.db.claims.find((c) => c.claim.id === ids.claim);
    if (claim) claim.claim.status = "closed";
    await open();

    await kitchen();
    expect(screen.queryByRole("button", { name: "Log a visit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change point 1" })).not.toBeInTheDocument();
  });
});
