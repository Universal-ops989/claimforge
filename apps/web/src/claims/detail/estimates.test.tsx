import { ids } from "@claimforge/api-client/fixtures";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { backend, renderApp } from "../../test/render";

const CLAIM = "/lone-star/claims/2026-00042";
const EDITOR = `${CLAIM}/estimates/${ids.estimate}`;

type User = ReturnType<typeof userEvent.setup>;

const open = (
  path: string,
  as: "morgan@example.com" | "riley@example.com" = "morgan@example.com",
) => renderApp(path, { signedInAs: as });
const lines = async () => {
  const table = await screen.findByRole("table");
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);
};
const total = async (label: RegExp | string) => {
  const card = within(await screen.findByRole("region", { name: "Totals" }));
  const term = card.getByText(label);
  return term.nextElementSibling?.textContent;
};

async function fill(user: User, label: RegExp, text: string) {
  const field = screen.getByRole("textbox", { name: label });
  await user.clear(field);
  await user.click(field);
  await user.paste(text);
}

async function lineMenu(user: User, position: number, item: string) {
  await user.click(screen.getByRole("button", { name: `Change line ${String(position)}` }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

describe("the estimates", () => {
  test("are listed with status and total, each opening its editor", async () => {
    const user = userEvent.setup();
    const { router } = await open(`${CLAIM}/estimates`);

    const list = within(await screen.findByRole("list", { name: "Estimates" }));
    const item = list.getByRole("listitem");
    expect(item).toHaveTextContent("Draft");
    expect(item).toHaveTextContent("$507.60");
    await user.click(list.getByRole("link", { name: "Estimate 1 · Mitigation" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(EDITOR);
    });
    expect(screen.getByRole("tab", { name: "Estimates" })).toHaveAttribute("aria-selected", "true");
  });

  test("a new one starts, numbered on, and opens", async () => {
    const user = userEvent.setup();
    const { router } = await open(`${CLAIM}/estimates`);

    await user.click(await screen.findByRole("button", { name: "New estimate" }));
    await fill(user, /^Title/, "Rebuild");
    await user.click(screen.getByRole("button", { name: "Start estimate" }));

    expect(
      await screen.findByRole("heading", { name: "Estimate 2 · Rebuild" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/\/estimates\/[0-9a-f-]+$/);
    expect(
      screen.getByText("No lines yet. Add them from your price list or by hand."),
    ).toBeInTheDocument();
  });

  test("someone not allowed to estimate sees them, and can't start one", async () => {
    await open(`${CLAIM}/estimates`, "riley@example.com");

    await screen.findByRole("list", { name: "Estimates" });
    expect(screen.queryByRole("button", { name: "New estimate" })).not.toBeInTheDocument();
  });
});

describe("the editor", () => {
  test("shows the lines and the totals as the API works them out", async () => {
    await open(EDITOR);

    expect(await lines()).toEqual([
      expect.stringMatching(
        /^1WTR-DEHU · Dehumidifier, per dayKitchen · Not taxed3 DA\$85\.00\$255\.00/,
      ),
      expect.stringMatching(
        /^2WTR-AIRM · Air mover, per dayKitchen · Not taxed6 DA\$28\.00\$168\.00/,
      ),
    ]);
    expect(await total("Subtotal")).toBe("$423.00");
    expect(await total("Overhead 10%")).toBe("$42.30");
    expect(await total("Total")).toBe("$507.60");
    expect(
      within(screen.getByRole("region", { name: "By room" })).getByText("Kitchen (2 lines)"),
    ).toBeInTheDocument();
  });

  test("a line from the price list, with a preview of what it comes to", async () => {
    const user = userEvent.setup();
    await open(EDITOR);
    await lines();

    await user.click(screen.getByRole("button", { name: "Add a line" }));
    const search = await screen.findByRole("searchbox", { name: /^Search the price list/ });
    await user.click(search);
    await user.paste("drywall");
    await user.click(
      await screen.findByRole("button", { name: "Choose DRY-RMVF, Drywall, flood cut to 2 ft" }),
    );
    await fill(user, /^Quantity/, "24");
    expect(screen.getByText("Line total $74.40")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add line" }));

    await waitFor(async () => {
      expect(await lines()).toHaveLength(3);
    });
    expect((await lines())[2]).toMatch(/DRY-RMVF.*Taxed24 LF\$3\.10\$74\.40/);
    expect(await total("Subtotal")).toBe("$497.40");
  });

  test("a line by hand, checked before it's sent", async () => {
    const user = userEvent.setup();
    await open(EDITOR);
    await lines();

    await user.click(screen.getByRole("button", { name: "Add a line" }));
    await user.click(await screen.findByRole("button", { name: "Enter a line by hand" }));
    await fill(user, /^Unit price/, "1.234");
    await user.click(screen.getByRole("button", { name: "Add line" }));

    const form = within(screen.getByRole("dialog"));
    expect(await form.findByText("Describe the work.")).toBeInTheDocument();
    expect(form.getByText("Enter the quantity.")).toBeInTheDocument();
    expect(form.getByText("Enter the unit price to the hundredth at most.")).toBeInTheDocument();

    await fill(user, /^Description/, "Haul-off");
    await fill(user, /^Unit$/, "EA");
    await fill(user, /^Unit price/, "$150");
    await fill(user, /^Quantity/, "1");
    await user.click(screen.getByRole("button", { name: "Add line" }));

    await waitFor(async () => {
      expect((await lines())[2]).toMatch(/^3Haul-off.*1 EA\$150\.00\$150\.00/);
    });
  });

  test("a line is edited, moved and deleted", async () => {
    const user = userEvent.setup();
    await open(EDITOR);
    await lines();

    await lineMenu(user, 1, "Edit");
    await fill(user, /^Quantity/, "4");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(async () => {
      expect((await lines())[0]).toMatch(/4 DA\$85\.00\$340\.00/);
    });

    await lineMenu(user, 1, "Move down");
    await waitFor(async () => {
      expect((await lines())[0]).toMatch(/^1WTR-AIRM/);
    });

    await lineMenu(user, 2, "Delete");
    await waitFor(async () => {
      expect(await lines()).toEqual([expect.stringMatching(/^1WTR-AIRM/)]);
    });
  });

  test("its rates change the totals; a rate over 100 is pointed out", async () => {
    const user = userEvent.setup();
    await open(EDITOR);
    await lines();

    await user.click(screen.getByRole("button", { name: "Edit details" }));
    await fill(user, /^Overhead/, "120");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("The overhead rate can be up to 100.")).toBeInTheDocument();

    await fill(user, /^Overhead/, "15");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Overhead 15%")).toBeInTheDocument();
    expect(await total("Overhead 15%")).toBe("$63.45");
  });

  test("an estimate that isn't a draft is shown, not changed", async () => {
    const seeded = backend.db.estimates[0];
    if (seeded) seeded.estimate.status = "submitted";
    await open(EDITOR);

    expect(
      await screen.findByText(/This estimate is submitted, so its lines can't change/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add a line" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Change line/ })).not.toBeInTheDocument();
  });
});
