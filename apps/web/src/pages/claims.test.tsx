import { mockApi, problem } from "@claimforge/api-client/msw";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { API_URL, backend, renderApp, server } from "../test/render";

const mock = mockApi(API_URL);
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
