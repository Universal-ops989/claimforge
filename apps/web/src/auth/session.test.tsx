import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { renderApp } from "../test/render";
import { createSessionStore, SESSION_KEY } from "./session-store";

afterEach(() => {
  localStorage.clear();
});

const heading = () => screen.getByRole("heading", { level: 1 });

describe("signed-in pages", () => {
  test("send a signed-out visitor to sign in, then back where they were going", async () => {
    const { router } = await renderApp("/claims/2026-00042?tab=photos");

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(router.state.location.search).toBe("?next=%2Fclaims%2F2026-00042%3Ftab%3Dphotos");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/^Email/), "morgan@example.com");
    await user.type(screen.getByLabelText(/^Password/), "correct horse battery staple");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(heading()).toHaveTextContent("Claim 2026-00042");
    });
    expect(router.state.location.search).toBe("?tab=photos");
  });

  test("send the user to sign in as soon as the session ends", async () => {
    const { router, session } = await renderApp("/claims", { signedInAs: "morgan@example.com" });
    expect(heading()).toHaveTextContent("Claims");

    act(() => {
      session.set(null); // refused refresh, another tab signing out, …
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(router.state.location.search).toBe("?next=%2Fclaims");
  });

  test("open straight away after a reload, from the stored session", async () => {
    const first = await renderApp("/", {
      signedInAs: "morgan@example.com",
      session: createSessionStore(localStorage, SESSION_KEY, null),
    });
    first.unmount();

    await renderApp("/claims", { session: createSessionStore(localStorage, SESSION_KEY, null) });

    expect(heading()).toHaveTextContent("Claims");
  });
});

describe("the sign-in page", () => {
  test("sends someone already signed in on to where they were going", async () => {
    const { router } = await renderApp("/login?next=%2Fsettings", {
      signedInAs: "morgan@example.com",
    });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/settings");
    });
  });

  test("or to the dashboard", async () => {
    const { router } = await renderApp("/login", { signedInAs: "morgan@example.com" });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/");
    });
  });
});
