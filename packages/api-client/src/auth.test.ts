import { describe, expect, test, vi } from "vitest";

import {
  createApiClient,
  isApiError,
  memoryTokenStore,
  NetworkError,
  type RefreshLock,
  type Schema,
  type Tokens,
  type TokenStore,
  webLock,
} from "./index";

const NOW = Date.parse("2026-11-16T12:00:00Z");
const DAY = 86_400_000;

function json(body: unknown, status = 200): Response {
  const type = status >= 400 ? "application/problem+json" : "application/json";
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": type } });
}

function problem(status: number, code: string): Response {
  return json(
    { type: "about:blank", title: code, status, detail: code, instance: "/", code },
    status,
  );
}

/**
 * Behaves like the API's auth: rotating refresh tokens, and presenting one that was
 * already exchanged revokes every token of the session.
 */
class FakeApi {
  readonly access = new Set<string>();
  readonly refresh = new Map<string, "live" | "used">();
  readonly calls: string[] = [];
  refreshAnswer: (() => Response) | null = null;
  reused = false;
  private issued = 0;

  issue(): Schema<"TokenResponse"> {
    this.issued += 1;
    const n = String(this.issued);
    this.access.add(`access-${n}`);
    this.refresh.set(`refresh-${n}`, "live");
    return {
      access_token: `access-${n}`,
      token_type: "bearer",
      expires_in: 900,
      refresh_token: `refresh-${n}`,
      refresh_expires_at: new Date(NOW + 30 * DAY).toISOString(),
    };
  }

  /** The server stops accepting every access token, as when they expire. */
  expireAccessTokens(): void {
    this.access.clear();
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const path = new URL(request.url).pathname;
    const bearer = request.headers.get("Authorization")?.replace("Bearer ", "") ?? null;
    this.calls.push(`${path} ${bearer ?? "-"}`);

    if (path === "/v1/auth/login") {
      const { password } = (await request.json()) as { password: string };
      return password === "right" ? json(this.issue()) : problem(401, "invalid_credentials");
    }
    if (path === "/v1/auth/refresh") {
      await new Promise((resolve) => setTimeout(resolve, 5)); // let concurrent calls pile up
      if (this.refreshAnswer) return this.refreshAnswer();
      const { refresh_token: token } = (await request.json()) as { refresh_token: string };
      const state = this.refresh.get(token);
      if (state === "used") {
        this.reused = true;
        this.access.clear();
        this.refresh.clear();
        return problem(401, "refresh_token_reused");
      }
      if (state === undefined) return problem(401, "invalid_refresh_token");
      this.refresh.set(token, "used");
      return json(this.issue());
    }
    if (path === "/v1/auth/logout") {
      const { refresh_token: token } = (await request.json()) as { refresh_token: string };
      this.refresh.delete(token);
      return new Response(null, { status: 204 });
    }
    if (bearer === null || !this.access.has(bearer)) {
      return problem(401, "authentication_required");
    }
    return json({ id: "me", via: bearer });
  };
}

interface Setup {
  server?: FakeApi;
  store?: TokenStore;
  lock?: RefreshLock;
  clock?: { now: number };
}

function setup({
  server = new FakeApi(),
  store = memoryTokenStore(),
  lock,
  clock = { now: NOW },
}: Setup = {}) {
  const onSessionExpired = vi.fn();
  const api = createApiClient({
    baseUrl: "https://api.test",
    fetch: (input, init) => server.fetch(input, init), // late-bound: tests swap it
    auth: { tokens: store, onSessionExpired, now: () => clock.now, ...(lock ? { lock } : {}) },
  });
  return { api, server, store, clock, onSessionExpired };
}

async function me(api: ReturnType<typeof setup>["api"]): Promise<unknown> {
  return api.get("/v1/me");
}

/** Runs tasks one at a time, like a Web Lock shared by tabs. */
function mutex(): RefreshLock {
  let tail: Promise<unknown> = Promise.resolve();
  return (task) => {
    const run = tail.then(task);
    tail = run.catch(() => undefined);
    return run;
  };
}

describe("signing in", () => {
  test("login keeps the tokens and later calls carry them", async () => {
    const { api, server, store } = setup();

    const tokens = await api.login({ email: "morgan@example.com", password: "right" });

    expect(tokens).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessExpiresAt: NOW + 900_000,
      refreshExpiresAt: NOW + 30 * DAY,
    });
    expect(await store.get()).toEqual(tokens);
    expect(await me(api)).toEqual({ id: "me", via: "access-1" });
    expect(server.calls).toEqual(["/v1/auth/login -", "/v1/me access-1"]);
  });

  test("a refused login keeps nothing", async () => {
    const { api, store } = setup();

    const error: unknown = await api
      .login({ email: "morgan@example.com", password: "wrong" })
      .catch((caught: unknown) => caught);

    expect(isApiError(error, "invalid_credentials")).toBe(true);
    expect(await store.get()).toBeNull();
  });

  test("login needs the auth option", async () => {
    const api = createApiClient({ baseUrl: "https://api.test" });

    await expect(api.login({ email: "a@b.co", password: "x" })).rejects.toThrow(
      "Pass `auth` to createApiClient",
    );
  });
});

describe("refreshing", () => {
  test("a 401 refreshes once and retries the call", async () => {
    const { api, server, store } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });
    server.expireAccessTokens();

    expect(await me(api)).toEqual({ id: "me", via: "access-2" });

    expect(server.calls.slice(1)).toEqual([
      "/v1/me access-1",
      "/v1/auth/refresh -",
      "/v1/me access-2",
    ]);
    expect((await store.get())?.refreshToken).toBe("refresh-2");
  });

  test("concurrent calls share one refresh", async () => {
    const { api, server } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });
    server.expireAccessTokens();

    const answers = await Promise.all([me(api), me(api), me(api), me(api), me(api)]);

    expect(answers).toEqual(Array(5).fill({ id: "me", via: "access-2" }));
    expect(server.calls.filter((call) => call.startsWith("/v1/auth/refresh"))).toHaveLength(1);
    expect(server.reused).toBe(false);
  });

  test("tabs sharing a store and a lock refresh once between them", async () => {
    const store = memoryTokenStore();
    const lock = mutex();
    const server = new FakeApi();
    const first = setup({ server, store, lock });
    const second = setup({ server, store, lock });
    await first.api.login({ email: "morgan@example.com", password: "right" });
    server.expireAccessTokens();

    await Promise.all([me(first.api), me(second.api)]);

    expect(server.calls.filter((call) => call.startsWith("/v1/auth/refresh"))).toHaveLength(1);
    expect(server.reused).toBe(false);
  });

  test("without a lock, two tabs would trip reuse detection (why webLock exists)", async () => {
    const store = memoryTokenStore();
    const server = new FakeApi();
    const first = setup({ server, store });
    const second = setup({ server, store });
    await first.api.login({ email: "morgan@example.com", password: "right" });
    server.expireAccessTokens();

    await Promise.allSettled([me(first.api), me(second.api)]);

    expect(server.reused).toBe(true);
  });

  test("the access token is refreshed shortly before it expires", async () => {
    const { api, server, clock } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });

    clock.now = NOW + 900_000 - 10_000; // 10 seconds left
    await me(api);

    expect(server.calls.slice(1)).toEqual(["/v1/auth/refresh -", "/v1/me access-2"]);
  });

  test("a second 401 is the answer, not a loop", async () => {
    const { api, server } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });
    server.fetch = (input, init) => {
      const path = new URL(new Request(input, init).url).pathname;
      server.calls.push(path);
      const answer =
        path === "/v1/auth/refresh"
          ? json(server.issue())
          : problem(401, "authentication_required");
      return Promise.resolve(answer);
    };

    const error: unknown = await me(api).catch((caught: unknown) => caught);

    expect(isApiError(error, "authentication_required")).toBe(true);
    expect(server.calls.slice(1)).toEqual(["/v1/me", "/v1/auth/refresh", "/v1/me"]);
  });

  test("other 401s are not refreshed", async () => {
    const { api, server } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });
    server.fetch = () => Promise.resolve(problem(401, "mfa_required"));

    await expect(me(api)).rejects.toMatchObject({ code: "mfa_required" });
  });
});

describe("ending the session", () => {
  test("a refused refresh signs out once, however many calls notice", async () => {
    const { api, server, store, onSessionExpired } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });
    server.expireAccessTokens();
    server.refresh.clear(); // revoked on the server

    const errors = await Promise.all(
      [me(api), me(api), me(api)].map((call) => call.catch((e: unknown) => e)),
    );

    for (const error of errors) {
      expect(isApiError(error, "authentication_required")).toBe(true);
    }
    expect(await store.get()).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  test("an expired refresh token isn't even sent", async () => {
    const { api, server, store, clock, onSessionExpired } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });

    clock.now = NOW + 31 * DAY;
    await expect(me(api)).rejects.toMatchObject({ status: 401 });

    expect(server.calls.slice(1)).toEqual(["/v1/me -"]);
    expect(await store.get()).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  test("a passing failure keeps the session", async () => {
    const { api, server, store, onSessionExpired } = setup();
    const tokens = await api.login({ email: "morgan@example.com", password: "right" });
    server.expireAccessTokens();
    server.refreshAnswer = () => problem(503, "service_unavailable");

    await expect(me(api)).rejects.toMatchObject({ status: 503 });

    expect(await store.get()).toEqual(tokens);
    expect(onSessionExpired).not.toHaveBeenCalled();
    server.refreshAnswer = null;
    expect(await me(api)).toEqual({ id: "me", via: "access-2" }); // and it recovers
  });

  test("logout forgets the tokens and revokes the session", async () => {
    const { api, server, store, onSessionExpired } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });

    await api.logout();

    expect(await store.get()).toBeNull();
    expect(server.refresh.has("refresh-1")).toBe(false);
    expect(server.calls.at(-1)).toBe("/v1/auth/logout -");
    expect(onSessionExpired).not.toHaveBeenCalled();
    await expect(me(api)).rejects.toMatchObject({ code: "authentication_required" });
  });

  test("logout works offline", async () => {
    const store = memoryTokenStore();
    const { api, server } = setup({ store });
    await api.login({ email: "morgan@example.com", password: "right" });
    server.fetch = () => Promise.reject(new TypeError("fetch failed"));

    await api.logout();

    expect(await store.get()).toBeNull();
    await expect(me(api)).rejects.toBeInstanceOf(NetworkError);
  });

  test("signing out during a refresh stays signed out", async () => {
    const { api, server, store } = setup();
    await api.login({ email: "morgan@example.com", password: "right" });
    server.expireAccessTokens();

    const call = me(api).catch((caught: unknown) => caught);
    await new Promise((resolve) => setTimeout(resolve, 1)); // the refresh is on its way
    await api.logout();

    expect(isApiError(await call, "authentication_required")).toBe(true);
    expect(await store.get()).toBeNull();
  });
});

test("tokens survive a JSON round trip", () => {
  const tokens: Tokens = {
    accessToken: "a",
    refreshToken: "r",
    accessExpiresAt: NOW,
    refreshExpiresAt: NOW + DAY,
  };
  expect(JSON.parse(JSON.stringify(tokens))).toEqual(tokens);
});

describe("webLock", () => {
  test("runs the task under a named Web Lock", async () => {
    const request = vi.fn((_name: string, task: () => Promise<string>) => task());
    vi.stubGlobal("navigator", { locks: { request } });
    try {
      const lock = webLock("tokens");
      expect(await lock?.(() => Promise.resolve("done"))).toBe("done");
      expect(request).toHaveBeenCalledWith("tokens", expect.any(Function));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("is undefined where Web Locks are missing", () => {
    vi.stubGlobal("navigator", {});
    try {
      expect(webLock()).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
