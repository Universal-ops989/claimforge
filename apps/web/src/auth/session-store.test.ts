import type { Tokens } from "@claimforge/api-client";
import { createMockBackend, MOCK_PASSWORD } from "@claimforge/api-client/msw";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createAppApiClient } from "../api/client";
import { API_URL, server } from "../test/render";
import { createSessionStore, SESSION_KEY } from "./session-store";

const TOKENS: Tokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  accessExpiresAt: 1_800_000_000_000,
  refreshExpiresAt: 1_900_000_000_000,
};

/** Each "tab" hears its own storage events, as each window does. */
const tab = () => new EventTarget() as unknown as Window;

/** What the browser does in every other tab when this one writes `key`. */
function tellTab(target: Window, key: string | null, newValue: string | null) {
  target.dispatchEvent(new StorageEvent("storage", { key, newValue, storageArea: localStorage }));
}

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe("the session store", () => {
  test("keeps the session across reloads", () => {
    createSessionStore(localStorage, SESSION_KEY, tab()).set(TOKENS);

    const afterReload = createSessionStore(localStorage, SESSION_KEY, tab());

    expect(afterReload.get()).toEqual(TOKENS);
  });

  test("signing out forgets it", () => {
    const store = createSessionStore(localStorage, SESSION_KEY, tab());
    store.set(TOKENS);

    store.set(null);

    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(createSessionStore(localStorage, SESSION_KEY, tab()).get()).toBeNull();
  });

  test.each([
    ["not JSON", "{oops"],
    ["not an object", '"access-1"'],
    ["missing fields", JSON.stringify({ accessToken: "a" })],
    ["wrong types", JSON.stringify({ ...TOKENS, accessExpiresAt: "soon" })],
  ])("reads %s as signed out", (_, stored) => {
    localStorage.setItem(SESSION_KEY, stored);

    expect(createSessionStore(localStorage, SESSION_KEY, tab()).get()).toBeNull();
  });

  test("works in memory when the browser refuses storage", () => {
    const refusing = {
      getItem: () => {
        throw new DOMException("denied", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: () => undefined,
    } as unknown as Storage;
    const store = createSessionStore(refusing, SESSION_KEY, tab());

    store.set(TOKENS);

    expect(store.get()).toEqual(TOKENS);
  });

  test("takes up what another tab does, and tells its listeners", () => {
    const here = tab();
    const store = createSessionStore(localStorage, SESSION_KEY, here);
    const heard = vi.fn();
    store.subscribe(heard);

    tellTab(here, SESSION_KEY, JSON.stringify(TOKENS)); // signed in over there
    const signedIn = store.get();
    tellTab(here, SESSION_KEY, null); // signed out over there
    const signedOut = store.get();
    tellTab(here, "something.else", "x"); // not ours

    expect(signedIn).toEqual(TOKENS);
    expect(signedOut).toBeNull();
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test("another tab clearing all site data signs this one out", () => {
    const here = tab();
    const store = createSessionStore(localStorage, SESSION_KEY, here);
    store.set(TOKENS);

    tellTab(here, null, null);

    expect(store.get()).toBeNull();
  });
});

describe("how a session ended", () => {
  test("is nothing before anyone signed in, and while signed in", () => {
    const store = createSessionStore(null, SESSION_KEY, tab());
    const before = store.endedBy();
    store.set(TOKENS);

    expect([before, store.endedBy()]).toEqual([null, null]);
  });

  test("is the user's own sign-out only when it was announced", () => {
    const store = createSessionStore(null, SESSION_KEY, tab());
    store.set(TOKENS);
    store.expectSignOut();
    store.set(null);
    const signedOut = store.endedBy();

    store.set(TOKENS);
    store.set(null); // a refused refresh
    const ended = store.endedBy();

    expect([signedOut, ended]).toEqual(["sign-out", "ended"]);
  });

  test("an announced sign-out doesn't linger to a later end", () => {
    const store = createSessionStore(null, SESSION_KEY, tab());
    store.expectSignOut();
    store.set(TOKENS); // signed in instead
    store.set(null);

    expect(store.endedBy()).toBe("ended");
  });

  test("another tab ending it reads as ended", () => {
    const here = tab();
    const store = createSessionStore(localStorage, SESSION_KEY, here);
    store.set(TOKENS);

    tellTab(here, SESSION_KEY, null);

    expect(store.endedBy()).toBe("ended");
  });
});

describe("two tabs, one session", () => {
  /**
   * Tab A refreshes, rotating the refresh token; then tab B's access token runs out too.
   * The API revokes a refresh token presented twice, so B must refresh with A's new one.
   */
  async function twoTabs({ sync }: { sync: boolean }) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse("2026-11-17T09:00:00Z"));
    const backend = createMockBackend({ baseUrl: API_URL });
    server.use(...backend.handlers);
    const [windowA, windowB] = [tab(), tab()];
    const storeA = createSessionStore(localStorage, SESSION_KEY, windowA);
    const storeB = createSessionStore(localStorage, SESSION_KEY, windowB);
    // What the browser does: a write in one tab is an event in the other.
    storeA.subscribe(() => {
      if (sync) tellTab(windowB, SESSION_KEY, localStorage.getItem(SESSION_KEY));
    });
    const config = { apiUrl: API_URL, mockApi: false, production: false };
    const tabA = createAppApiClient(config, storeA);
    const tabB = createAppApiClient(config, storeB);
    let ended = false;
    storeB.subscribe(() => {
      if (sync && storeB.get() === null) ended = true;
    });

    await tabA.login({ email: "morgan@example.com", password: MOCK_PASSWORD });
    if (!sync) storeB.set(storeA.get()); // B signed in from the stored session at load
    vi.setSystemTime(Date.now() + 901_000);
    await tabA.get("/v1/me"); // A refreshes: the old refresh token is now used
    vi.setSystemTime(Date.now() + 901_000);
    const fromB = await tabB.get("/v1/me").then(
      (me) => me.full_name,
      (error: unknown) => error,
    );
    return { fromB, ended };
  }

  test("tab B refreshes with the token tab A rotated, and stays signed in", async () => {
    const { fromB, ended } = await twoTabs({ sync: true });

    expect(fromB).toBe("Morgan Member");
    expect(ended).toBe(false);
  });

  test("without the storage events, B would replay a used token and lose the session", async () => {
    const { fromB } = await twoTabs({ sync: false });

    expect(fromB).toMatchObject({ code: "authentication_required" });
  });
});
