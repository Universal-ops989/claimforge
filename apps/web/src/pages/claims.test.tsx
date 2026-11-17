import { claim, fixtureId, ids } from "@claimforge/api-client/fixtures";
import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { createViewStore } from "../claims/saved-views";
import { API_URL, backend, renderApp, server } from "../test/render";

const mock = mockApi(API_URL);

afterEach(() => {
  localStorage.clear();
});
const open = () => renderApp("/lone-star/claims", { signedInAs: "morgan@example.com" });

/** The table's body rows, as the text of each cell. */
async function rows() {
  const table = await screen.findByRole("table", { name: "Claims" });
  await within(table).findByRole("link", { name: "2026-00042" });
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
}

describe("the claims list", () => {
  test("shows each claim's number, status, loss, place, date, adjuster", async () => {
    await open();

    const [newest, older] = await rows();

    expect(newest?.slice(0, 6)).toEqual([
      "2026-00042",
      "New",
      "Water",
      "100 Congress Ave, Austin, TX 78701",
      "Nov 10, 2026",
      "Unassigned",
    ]);
    expect(older?.slice(0, 3)).toEqual(["2026-00041", "Inspected", "Fire"]);
  });

  test("a claim's number is a real link, and its whole row opens it", async () => {
    const { router } = await open();
    await rows();

    expect(screen.getByRole("link", { name: "2026-00041" })).toHaveAttribute(
      "href",
      "/lone-star/claims/2026-00041",
    );
    await userEvent.setup().click(screen.getByText("Fire"));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/lone-star/claims/2026-00041");
    });
  });

  test("New claim is in the header", async () => {
    await open();

    expect(await screen.findByRole("link", { name: "New claim" })).toHaveAttribute(
      "href",
      "/lone-star/claims/new",
    );
  });

  test("an organization with no claims yet is told why, and how to start", async () => {
    backend.db.claims = [];

    await open();

    expect(await screen.findByRole("heading", { name: "No claims yet" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New claim" })).toHaveLength(2);
  });

  test("a failed load says so, and Try again loads it", async () => {
    server.use(
      mock.get("/v1/organizations/{organization_id}/claims", () => problem(500, "internal_error")),
    );
    await open();

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    server.resetHandlers();
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "2026-00042" })).toBeInTheDocument();
  });
});

describe("filters", () => {
  const numbers = () =>
    within(screen.getByRole("table", { name: "Claims" }))
      .queryAllByRole("link")
      .map((link) => link.textContent);
  const at = (path: string) => renderApp(path, { signedInAs: "morgan@example.com" });

  test("a filtered address shows the filtered list, and says so on the button", async () => {
    await at("/lone-star/claims?status=inspected");

    await waitFor(() => {
      expect(numbers()).toEqual(["2026-00041"]);
    });
    expect(screen.getByRole("button", { name: "Status: Inspected" })).toBeInTheDocument();
  });

  test("picking a loss type filters, and writes it into the address", async () => {
    const { router } = await at("/lone-star/claims");
    await screen.findByRole("link", { name: "2026-00041" });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Loss type" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Water" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(numbers()).toEqual(["2026-00042"]);
    });
    expect(router.state.location.search).toBe("?loss_type=water");
  });

  test("the search asks once typing pauses", async () => {
    const { router } = await at("/lone-star/claims");
    await screen.findByRole("link", { name: "2026-00042" });

    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search claims" }), "00041");

    await waitFor(() => {
      expect(numbers()).toEqual(["2026-00041"]);
    });
    expect(router.state.location.search).toBe("?q=00041");
  });

  test("Clear filters brings everything back, and keeps the rest of the address", async () => {
    const { router } = await at("/lone-star/claims?sort=-updated_at&status=new&q=00042");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect(numbers()).toHaveLength(2);
    });
    expect(router.state.location.search).toBe("?sort=-updated_at");
    expect(screen.getByRole("searchbox", { name: "Search claims" })).toHaveValue("");
  });

  test("no matches is told apart from no claims", async () => {
    await at("/lone-star/claims?q=nowhere");

    expect(
      await screen.findByRole("heading", { name: "No claims match these filters" }),
    ).toBeInTheDocument();
    await userEvent.setup().click(
      within(screen.getByRole("table", { name: "Claims" })).getByRole("button", {
        name: "Clear filters",
      }),
    );
    expect(await screen.findByRole("link", { name: "2026-00041" })).toBeInTheDocument();
  });

  test("values it doesn't know are ignored", async () => {
    await at("/lone-star/claims?status=bogus&loss_type=lava");

    await waitFor(() => {
      expect(numbers()).toHaveLength(2);
    });
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });
});

describe("sorting and paging", () => {
  const numbers = () =>
    within(screen.getByRole("table", { name: "Claims" }))
      .queryAllByRole("link")
      .map((link) => link.textContent);
  const at = (path: string) => renderApp(path, { signedInAs: "morgan@example.com" });

  /** 30 more claims, opened in November after the seeded ones. */
  function thirtyMore() {
    for (let n = 1; n <= 30; n += 1) {
      const number = `2026-${String(100 + n).padStart(5, "0")}`;
      backend.db.claims.push({
        organizationId: ids.organization,
        claim: claim({
          id: fixtureId("claim", 100 + n),
          number,
          created_at: `2026-11-${String(n).padStart(2, "0")}T18:00:00Z`,
        }),
      });
    }
  }

  test("an address with a sort lists in that order, and the menu says which", async () => {
    await at("/lone-star/claims?sort=created_at");

    await waitFor(() => {
      expect(numbers()).toEqual(["2026-00041", "2026-00042"]);
    });
    expect(screen.getByRole("combobox", { name: "Sort claims" })).toHaveTextContent("Oldest first");
  });

  test("choosing a sort reorders and writes it into the address, beside the filters", async () => {
    const { router } = await at("/lone-star/claims?status=new&status=inspected");
    await waitFor(() => {
      expect(numbers()).toEqual(["2026-00042", "2026-00041"]);
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("combobox", { name: "Sort claims" }));
    await user.click(await screen.findByRole("option", { name: "Oldest first" }));

    await waitFor(() => {
      expect(numbers()).toEqual(["2026-00041", "2026-00042"]);
    });
    expect(router.state.location.search).toBe("?status=new&status=inspected&sort=created_at");
  });

  test("headers don't pretend to sort the whole list", async () => {
    await at("/lone-star/claims");
    await screen.findByRole("link", { name: "2026-00042" });

    for (const header of screen.getAllByRole("columnheader")) {
      expect(within(header).queryByRole("button")).not.toBeInTheDocument();
    }
  });

  test("Load more adds the next page, until everything is in", async () => {
    thirtyMore();
    await at("/lone-star/claims");

    expect(await screen.findByText("Showing 25 claims")).toBeInTheDocument();
    expect(numbers()).toHaveLength(25);
    await userEvent.setup().click(screen.getByRole("button", { name: "Load more claims" }));

    expect(await screen.findByText("Showing all 32 claims")).toBeInTheDocument();
    expect(numbers()).toHaveLength(32);
    expect(screen.queryByRole("button", { name: "Load more claims" })).not.toBeInTheDocument();
  });
});

describe("saved views", () => {
  const numbers = () =>
    within(screen.getByRole("table", { name: "Claims" }))
      .queryAllByRole("link")
      .map((link) => link.textContent);
  const at = (path: string) => renderApp(path, { signedInAs: "morgan@example.com" });

  test("saving the list as a view names it on the button", async () => {
    await at("/lone-star/claims?loss_type=fire&sort=created_at");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Views" }));
    await user.click(await screen.findByRole("menuitem", { name: "Save this view…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Save this view" }));
    await user.type(dialog.getByRole("textbox", { name: /^Name/ }), "Fires, oldest first");
    await user.click(dialog.getByRole("button", { name: "Save view" }));

    expect(
      await screen.findByRole("button", { name: "View: Fires, oldest first" }),
    ).toBeInTheDocument();
  });

  test("a name already used is refused in the dialog", async () => {
    createViewStore(localStorage, ids.organization).save("Fires", "loss_type=fire");
    await at("/lone-star/claims?loss_type=water");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Views" }));
    await user.click(await screen.findByRole("menuitem", { name: "Save this view…" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByRole("textbox", { name: /^Name/ }), "fires");
    await user.click(dialog.getByRole("button", { name: "Save view" }));

    expect(await dialog.findByText('There\'s already a view called "fires".')).toBeInTheDocument();
  });

  test("choosing a view opens the list as it was saved", async () => {
    createViewStore(localStorage, ids.organization).save("Water", "loss_type=water");
    const { router } = await at("/lone-star/claims");
    await waitFor(() => {
      expect(numbers()).toHaveLength(2);
    });
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Views" }));
    await user.click(await screen.findByRole("menuitemcheckbox", { name: "Water" }));

    await waitFor(() => {
      expect(numbers()).toEqual(["2026-00042"]);
    });
    expect(router.state.location.search).toBe("?loss_type=water");
    expect(screen.getByRole("button", { name: "View: Water" })).toBeInTheDocument();
  });

  test("the view shown can be deleted", async () => {
    createViewStore(localStorage, ids.organization).save("Water", "loss_type=water");
    await at("/lone-star/claims?loss_type=water");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "View: Water" }));
    await user.click(await screen.findByRole("menuitem", { name: 'Delete "Water"' }));

    expect(await screen.findByRole("button", { name: "Views" })).toBeInTheDocument();
    expect(createViewStore(localStorage, ids.organization).list()).toEqual([]);
  });

  test("an unfiltered list can't be saved: there's nothing to keep", async () => {
    await at("/lone-star/claims");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Views" }));

    expect(await screen.findByRole("menuitem", { name: "Save this view…" })).toHaveAttribute(
      "data-disabled",
    );
    expect(screen.getByText("No saved views yet")).toBeInTheDocument();
  });
});
