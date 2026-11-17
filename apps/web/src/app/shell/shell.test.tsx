import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { renderApp } from "../../test/render";

afterEach(() => {
  localStorage.clear();
});

const signedIn = (path: string) => renderApp(path, { signedInAs: "morgan@example.com" });
const nav = async () => within(await screen.findByRole("navigation", { name: "Main" }));
const current = async () =>
  (await nav())
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("navigation", () => {
  test("lists the app's sections", async () => {
    await signedIn("/lone-star");

    expect((await nav()).getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Dashboard",
      "Claims",
      "Settings",
    ]);
  });

  test.each([
    ["/lone-star", "Dashboard"],
    ["/lone-star/claims", "Claims"],
    ["/lone-star/claims/new", "Claims"],
    ["/lone-star/claims/2026-00042", "Claims"],
    ["/lone-star/settings", "Settings"],
  ])("on %s, %s is the current section", async (path, section) => {
    await signedIn(path);

    expect(await current()).toEqual([section]);
  });

  test("follows the user", async () => {
    const { router } = await signedIn("/lone-star");

    await userEvent.setup().click((await nav()).getByRole("link", { name: "Claims" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/lone-star/claims");
    });
    await waitFor(async () => {
      expect(await current()).toEqual(["Claims"]);
    });
  });

  test("pages sit in the main landmark", async () => {
    await signedIn("/lone-star/claims");

    const heading = await screen.findByRole("heading", { level: 1, name: "Claims" });
    expect(screen.getByRole("main")).toContainElement(heading);
  });
});

describe("the user menu", () => {
  test("says who is signed in, and leads to settings", async () => {
    const { router } = await signedIn("/lone-star/claims");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Account: Morgan Member" }));
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByText("morgan@example.com")).toBeInTheDocument();
    await user.click(menu.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/lone-star/settings");
    });
  });
});

describe("the sidebar", () => {
  test("stays collapsed across visits once collapsed", async () => {
    const first = await signedIn("/lone-star");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Collapse sidebar" }));
    first.unmount();

    await signedIn("/lone-star");

    expect(await screen.findByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
