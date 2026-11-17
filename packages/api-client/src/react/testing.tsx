/**
 * Test helpers for the hooks: a fake API that routes by method and path, and `renderHook`
 * wrapped in the providers. Test-only; excluded from the build.
 */
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { memoryTokenStore, type Tokens, type TokenStore } from "../auth";
import { createApiClient } from "../client";
import { CLAIM_NUMBER, ids, people } from "../fixtures";
import { ApiProvider } from "./context";
import { createQueryClient } from "./query-client";

export const NOW = Date.parse("2026-11-16T12:00:00Z");

// The fixtures, under the names these tests use.
export { claim, me, tokenPair } from "../fixtures";
export { CLAIM_NUMBER };
export const ORG_ID = ids.organization;
export const CLAIM_ID = ids.claim;
export const MORGAN = people.morgan;
export const RILEY = people.riley;

export function json(body: unknown, status = 200): Response {
  const type = status >= 400 ? "application/problem+json" : "application/json";
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": type } });
}

export function problem(status: number, code: string): Response {
  return json(
    { type: "about:blank", title: code, status, detail: code, instance: "/", code },
    status,
  );
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export function signedIn(n = 1): Tokens {
  return {
    accessToken: `access-${String(n)}`,
    refreshToken: `refresh-${String(n)}`,
    accessExpiresAt: NOW + 900_000,
    refreshExpiresAt: NOW + 30 * 86_400_000,
  };
}

type Handler = (request: Request) => Response | Promise<Response>;

/** Answers `METHOD /path` with a handler; anything unrouted is a 404 problem. */
export class FakeServer {
  /** `METHOD /path?query bearer-or-dash`, in order. */
  readonly calls: string[] = [];
  private readonly routes = new Map<string, Handler>();

  on(method: string, path: string, handler: Handler): this {
    this.routes.set(`${method} ${path}`, handler);
    return this;
  }

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const bearer = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "-";
    this.calls.push(`${request.method} ${url.pathname}${url.search} ${bearer}`);
    const handler = this.routes.get(`${request.method} ${url.pathname}`);
    return handler ? handler(request) : problem(404, "not_found");
  };
}

export interface Rendered {
  server?: FakeServer;
  tokens?: TokenStore;
  /** Share another render's cache, as two screens of one app would. */
  queryClient?: QueryClient;
}

/** `renderHook` inside a QueryClientProvider and an ApiProvider talking to `server`. */
export function renderWithApi<Result>(
  hook: () => Result,
  {
    server = new FakeServer(),
    tokens = memoryTokenStore(signedIn()),
    queryClient = createQueryClient({ defaultOptions: { queries: { retry: false } } }),
  }: Rendered = {},
) {
  const api = createApiClient({
    baseUrl: "https://api.test",
    fetch: server.fetch,
    auth: { tokens, now: () => NOW },
  });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
  }
  return { ...renderHook(hook, { wrapper }), api, queryClient, server, tokens };
}
