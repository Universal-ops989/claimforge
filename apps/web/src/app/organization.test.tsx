import { fixtureId, organization, people, rolePermissions } from "@claimforge/api-client/fixtures";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { backend, renderApp } from "../test/render";

afterEach(() => {
  localStorage.clear();
});

const GULF = organization({
  id: fixtureId("organization", 2),
  name: "Gulf Coast Restoration",
  slug: "gulf-coast",
});

/** Morgan works for a second company too, as an adjuster there. */
function joinGulfCoast() {
  backend.db.organizations.push(GULF);
  const morgan = backend.db.accounts.find((a) => a.user.id === people.morgan.id);
  morgan?.user.memberships.push({
    organization: { id: GULF.id, name: GULF.name, slug: GULF.slug },
    role: "adjuster",
    permissions: rolePermissions.adjuster,
  });
}

const morgan = { signedInAs: "morgan@example.com" as const };

describe("choosing an organization", () => {
  test("/ goes to the user's organization", async () => {
    const { router } = await renderApp("/", morgan);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/lone-star");
    });
  });

  test("/ goes to the one used last in this browser", async () => {
    joinGulfCoast();
    localStorage.setItem("claimforge.organization", "gulf-coast");

    const { router } = await renderApp("/", morgan);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/gulf-coast");
    });
  });

  test("a remembered organization the user has left is passed over", async () => {
    localStorage.setItem("claimforge.organization", "gulf-coast");

    const { router } = await renderApp("/", morgan);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/lone-star");
    });
  });

  test("someone in no organization is told how to get in, and can sign out", async () => {
    const riley = backend.db.accounts.find((a) => a.user.id === people.riley.id);
    if (riley) riley.user.memberships = [];

    const { router } = await renderApp("/", { signedInAs: "riley@example.com" });

    expect(
      await screen.findByRole("heading", { level: 1, name: "You're not in an organization yet" }),
    ).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
  });

  test("an organization the user isn't in is not found", async () => {
    await renderApp("/gulf-coast/claims", morgan);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("Page not found");
  });
});

describe("the switcher", () => {
  test("with one organization, just names it", async () => {
    await renderApp("/lone-star", morgan);

    expect(await screen.findByText("Lone Star Restoration")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Switch organization/ })).not.toBeInTheDocument();
  });

  test("switches, keeping the section but not the claim, and remembers", async () => {
    joinGulfCoast();
    const { router } = await renderApp("/lone-star/claims/2026-00042", morgan);
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", {
        name: "Organization: Lone Star Restoration. Switch organization",
      }),
    );
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByRole("menuitemcheckbox", { name: "Lone Star Restoration" })).toBeChecked();
    await user.click(menu.getByRole("menuitemcheckbox", { name: "Gulf Coast Restoration" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/gulf-coast/claims");
    });
    expect(localStorage.getItem("claimforge.organization")).toBe("gulf-coast");
  });

  test("navigation follows the organization", async () => {
    joinGulfCoast();
    await renderApp("/gulf-coast", morgan);

    const nav = within(await screen.findByRole("navigation", { name: "Main" }));

    expect(nav.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/gulf-coast",
      "/gulf-coast/claims",
      "/gulf-coast/settings",
    ]);
  });
});
