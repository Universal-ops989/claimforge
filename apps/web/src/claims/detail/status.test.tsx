import { ids, rolePermissions } from "@claimforge/api-client/fixtures";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { backend, renderApp } from "../../test/render";

const CLAIM = "/lone-star/claims/2026-00042";

function seededClaim() {
  const seeded = backend.db.claims.find((c) => c.claim.id === ids.claim);
  if (!seeded) throw new Error("no seeded claim");
  return seeded;
}

/** Make Morgan an adjuster: may change claims, but not reopen them. */
function morganAsAdjuster() {
  const morgan = backend.db.accounts.find((a) => a.email === "morgan@example.com");
  const membership = morgan?.user.memberships[0];
  if (!membership) throw new Error("no membership");
  membership.role = "adjuster";
  membership.permissions = rolePermissions.adjuster;
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Change status" }));
  return within(await screen.findByRole("menu"));
}

/** The status badge's text, from the header. */
const status = () =>
  screen.getByText(/^(New|Inspected|In progress|On hold|Completed|Closed|Cancelled)$/);

describe("changing the status", () => {
  test("offers only where the claim can go, in words", async () => {
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    const menu = await openMenu(user);

    expect(menu.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Mark as inspected",
      "Start work",
      "Put on hold…",
      "Cancel the claim…",
    ]);
  });

  test("a move that needs no reason happens at once, and is announced", async () => {
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    const menu = await openMenu(user);
    await user.click(menu.getByRole("menuitem", { name: "Mark as inspected" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Moved to Inspected.");
    expect(status()).toHaveTextContent("Inspected");
    expect(seededClaim().claim.status).toBe("inspected");
    // Where it can go now follows the new status.
    const next = await openMenu(user);
    expect(next.getByRole("menuitem", { name: "Start work" })).toBeInTheDocument();
    expect(next.queryByRole("menuitem", { name: "Mark as inspected" })).not.toBeInTheDocument();
  });

  test("a move the workflow wants explained asks why first", async () => {
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    const menu = await openMenu(user);
    await user.click(menu.getByRole("menuitem", { name: "Put on hold…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Put on hold" }));
    await user.click(dialog.getByRole("button", { name: "Put on hold" }));

    expect(await dialog.findByText("Say why.")).toBeInTheDocument();
    expect(seededClaim().claim.status).toBe("new");

    await user.type(dialog.getByRole("textbox", { name: /^Reason/ }), "  Waiting on the carrier ");
    await user.click(dialog.getByRole("button", { name: "Put on hold" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Moved to On hold.");
    expect(backend.db.statusChanges.at(-1)?.change).toMatchObject({
      to_status: "on_hold",
      reason: "Waiting on the carrier",
    });
  });

  test("someone else moving it first is said, and the page catches up", async () => {
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });
    const menu = await openMenu(user);
    // Meanwhile, elsewhere:
    seededClaim().claim = { ...seededClaim().claim, status: "in_progress", next_statuses: [] };

    await user.click(menu.getByRole("menuitem", { name: "Mark as inspected" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Someone else moved this claim to In progress first.",
    );
    await waitFor(() => {
      expect(status()).toHaveTextContent("In progress");
    });
    expect(seededClaim().claim.status).toBe("in_progress");
  });
});

describe("who can change it", () => {
  test("someone not allowed to change claims has no menu", async () => {
    await renderApp(CLAIM, { signedInAs: "riley@example.com" });

    await screen.findByText("Water loss", { exact: false });
    expect(screen.queryByRole("button", { name: "Change status" })).not.toBeInTheDocument();
  });

  test("reopening a closed claim takes the right to reopen", async () => {
    seededClaim().claim = {
      ...seededClaim().claim,
      status: "closed",
      next_statuses: ["in_progress"],
    };
    const user = userEvent.setup();
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    const menu = await openMenu(user);

    expect(menu.getByRole("menuitem", { name: "Reopen…" })).toBeInTheDocument();
  });

  test("an adjuster can move a claim but not reopen one", async () => {
    morganAsAdjuster();
    seededClaim().claim = {
      ...seededClaim().claim,
      status: "closed",
      next_statuses: ["in_progress"],
    };
    await renderApp(CLAIM, { signedInAs: "morgan@example.com" });

    await screen.findByText("Water loss", { exact: false });
    expect(screen.queryByRole("button", { name: "Change status" })).not.toBeInTheDocument();
  });
});
