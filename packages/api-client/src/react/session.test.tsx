// @vitest-environment jsdom
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { z } from "zod";

import { memoryTokenStore } from "../auth";
import { ApiError, NetworkError, ResponseValidationError } from "../errors";
import {
  createQueryClient,
  queryKeys,
  shouldRetry,
  useAcceptInvitation,
  useApi,
  useLogin,
  useLogout,
  useMe,
} from "./index";
import {
  FakeServer,
  json,
  me,
  noContent,
  ORG_ID,
  problem,
  renderWithApi,
  signedIn,
  tokenPair,
} from "./testing";

afterEach(cleanup);

function apiError(status: number): ApiError {
  return new ApiError({
    type: "about:blank",
    title: "x",
    status,
    detail: "x",
    instance: "/",
    code: "x",
  });
}

describe("providers", () => {
  test("useApi needs an ApiProvider", () => {
    const queryClient = createQueryClient();
    expect(() =>
      renderHook(() => useApi(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      }),
    ).toThrow("useApi() needs an <ApiProvider> above it");
  });
});

describe("useMe", () => {
  test("reads the signed-in user", async () => {
    const server = new FakeServer().on("GET", "/v1/me", () => json(me()));

    const { result, queryClient } = renderWithApi(() => useMe(), { server });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.memberships[0]?.organization.id).toBe(ORG_ID);
    expect(server.calls).toEqual(["GET /v1/me access-1"]);
    expect(queryClient.getQueryData(queryKeys.me())).toEqual(me());
  });

  test("a failure surfaces as the ApiError", async () => {
    const server = new FakeServer().on("GET", "/v1/me", () => problem(403, "permission_denied"));

    const { result } = renderWithApi(() => useMe(), { server });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "permission_denied" });
  });
});

describe("signing in and out", () => {
  test("login starts the cache over and refetches as the new user", async () => {
    let user = "Previous Person";
    const server = new FakeServer()
      .on("GET", "/v1/me", () => json(me({ full_name: user })))
      .on("POST", "/v1/auth/login", () => json(tokenPair(2)));
    const { result } = renderWithApi(() => ({ me: useMe(), login: useLogin() }), {
      server,
      tokens: memoryTokenStore(signedIn(1)),
    });
    await waitFor(() => {
      expect(result.current.me.data?.full_name).toBe("Previous Person");
    });

    user = "Morgan Member";
    await act(() => result.current.login.mutateAsync({ email: "m@example.com", password: "pw" }));

    await waitFor(() => {
      expect(result.current.me.data?.full_name).toBe("Morgan Member");
    });
    expect(server.calls).toEqual([
      "GET /v1/me access-1",
      "POST /v1/auth/login -",
      "GET /v1/me access-2",
    ]);
  });

  test("a refused login keeps the cache and reports the problem", async () => {
    const server = new FakeServer().on("POST", "/v1/auth/login", () =>
      problem(401, "invalid_credentials"),
    );
    const { result, queryClient } = renderWithApi(() => useLogin(), { server });
    queryClient.setQueryData(queryKeys.me(), me());

    await act(async () => {
      await result.current
        .mutateAsync({ email: "m@example.com", password: "wrong" })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.error).toMatchObject({ code: "invalid_credentials" });
    });
    expect(queryClient.getQueryData(queryKeys.me())).toEqual(me());
  });

  test("accepting an invitation signs in without the old session's token", async () => {
    const server = new FakeServer().on("POST", "/v1/invitations/accept", () => json(tokenPair(7)));
    const { result, tokens } = renderWithApi(() => useAcceptInvitation(), { server });

    await act(() =>
      result.current.mutateAsync({
        token: "invite-token",
        full_name: "New Person",
        password: "pw",
      }),
    );

    expect(server.calls).toEqual(["POST /v1/invitations/accept -"]);
    expect((await tokens.get())?.accessToken).toBe("access-7");
  });

  test("logout forgets the tokens and every cached query", async () => {
    const server = new FakeServer()
      .on("GET", "/v1/me", () => json(me()))
      .on("POST", "/v1/auth/logout", noContent);
    const { result, queryClient, tokens } = renderWithApi(
      () => ({ logout: useLogout(), other: useQuery({ queryKey: ["x"], queryFn: () => 1 }) }),
      { server },
    );
    queryClient.setQueryData(queryKeys.me(), me());
    await waitFor(() => {
      expect(result.current.other.data).toBe(1);
    });

    await act(() => result.current.logout.mutateAsync());

    expect(await tokens.get()).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(server.calls).toEqual(["POST /v1/auth/logout -"]);
  });

  test("logout still clears everything when the API can't be reached", async () => {
    const server = new FakeServer().on("POST", "/v1/auth/logout", () => {
      throw new TypeError("fetch failed");
    });
    const { result, queryClient, tokens } = renderWithApi(() => useLogout(), { server });
    queryClient.setQueryData(queryKeys.me(), me());

    await act(() => result.current.mutateAsync());

    expect(await tokens.get()).toBeNull();
    expect(queryClient.getQueryData(queryKeys.me())).toBeUndefined();
  });
});

describe("retries", () => {
  test("only failures that may pass are retried", () => {
    expect(shouldRetry(0, new NetworkError("get", "/v1/me", new TypeError()))).toBe(true);
    expect(shouldRetry(0, apiError(503))).toBe(true);
    expect(shouldRetry(0, apiError(429))).toBe(true);
    expect(shouldRetry(0, apiError(408))).toBe(true);
    expect(shouldRetry(0, apiError(404))).toBe(false);
    expect(shouldRetry(0, apiError(401))).toBe(false);
    expect(shouldRetry(0, new Error("bug"))).toBe(false);
    const { error } = z.string().safeParse(1);
    if (!error) throw new Error("expected a Zod error");
    expect(shouldRetry(0, new ResponseValidationError("get /v1/me", 200, 1, error))).toBe(false);
  });

  test("and at most three times", () => {
    expect(shouldRetry(2, apiError(503))).toBe(true);
    expect(shouldRetry(3, apiError(503))).toBe(false);
  });

  test("createQueryClient keeps what the caller passes", () => {
    const queryClient = createQueryClient({
      defaultOptions: { queries: { staleTime: 0 }, mutations: { retry: 1 } },
    });
    const defaults = queryClient.getDefaultOptions();

    expect(defaults.queries?.retry).toBe(shouldRetry);
    expect(defaults.queries?.staleTime).toBe(0);
    expect(defaults.mutations?.retry).toBe(1);
  });
});
