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

describe("signing out", () => {
  test("revokes the session, forgets the data and starts over at sign-in", async () => {
    const { router, session, api, queryClient } = await renderApp("/claims", {
      signedInAs: "morgan@example.com",
    });
    const held = session.get();
    expect(await screen.findByText("Morgan Member")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/login");
    });
    expect(router.state.location.search).toBe(""); // no way back: they chose to leave
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    const reuse = await api
      .post("/v1/auth/refresh", { body: { refresh_token: held?.refreshToken ?? "" } })
      .catch((error: unknown) => error);
    expect(reuse).toMatchObject({ code: "invalid_refresh_token" }); // revoked at the API
  });
});

describe("a session that ends on its own", () => {
  const ENDED = "Your session ended. Sign in again to pick up where you left off.";

  test("a refused refresh sends the user to sign in, told why, with the way back", async () => {
    const session = createSessionStore(null, SESSION_KEY, null);
    session.set({
      accessToken: "expired",
      refreshToken: "revoked-elsewhere",
      accessExpiresAt: Date.now() - 1_000,
      refreshExpiresAt: Date.now() + 86_400_000,
    });

    const { router } = await renderApp("/claims", { session });

    expect(await screen.findByRole("status")).toHaveTextContent(ENDED);
    expect(router.state.location.search).toBe("?next=%2Fclaims");
  });

  test("so does signing out in another tab", async () => {
    const { session } = await renderApp("/settings", {
      signedInAs: "morgan@example.com",
      session: createSessionStore(localStorage, SESSION_KEY, window),
    });
    expect(heading()).toHaveTextContent("Settings");

    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: SESSION_KEY,
          newValue: null,
          storageArea: localStorage,
        }),
      );
    });

    expect(await screen.findByRole("status")).toHaveTextContent(ENDED);
    expect(session.endedBy()).toBe("ended");
  });
});
