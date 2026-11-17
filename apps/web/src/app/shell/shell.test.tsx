import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { renderApp } from "../../test/render";

afterEach(() => {
  localStorage.clear();
});

const signedIn = (path: string) => renderApp(path, { signedInAs: "morgan@example.com" });
const nav = () => within(screen.getByRole("navigation", { name: "Main" }));
const current = () =>
  nav()
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("navigation", () => {
  test("lists the app's sections", async () => {
    await signedIn("/");

    expect(
      nav()
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Dashboard", "Claims", "Settings"]);
  });

  test.each([
    ["/", "Dashboard"],
    ["/claims", "Claims"],
    ["/claims/new", "Claims"],
    ["/claims/2026-00042", "Claims"],
    ["/settings", "Settings"],
  ])("on %s, %s is the current section", async (path, section) => {
    await signedIn(path);

    expect(current()).toEqual([section]);
  });

  test("follows the user", async () => {
    const { router } = await signedIn("/");

    await userEvent.setup().click(nav().getByRole("link", { name: "Claims" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/claims");
    });
    expect(current()).toEqual(["Claims"]);
  });

  test("pages sit in the main landmark", async () => {
    await signedIn("/claims");

    expect(screen.getByRole("main")).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Claims" }),
    );
  });
});

describe("the user menu", () => {
  test("says who is signed in, and leads to settings", async () => {
    const { router } = await signedIn("/claims");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Account: Morgan Member" }));
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByText("morgan@example.com")).toBeInTheDocument();
    await user.click(menu.getByRole("menuitem", { name: "Settings" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings");
    });
  });
});

describe("the sidebar", () => {
  test("stays collapsed across visits once collapsed", async () => {
    const first = await signedIn("/");
    await userEvent.setup().click(screen.getByRole("button", { name: "Collapse sidebar" }));
    first.unmount();

    await signedIn("/");

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
  });
});
