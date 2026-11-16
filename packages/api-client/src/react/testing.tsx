/**
 * Test helpers for the hooks: a fake API that routes by method and path, and `renderHook`
 * wrapped in the providers. Test-only; excluded from the build.
 */
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { memoryTokenStore, type Tokens, type TokenStore } from "../auth";
import { createApiClient } from "../client";
import type { Schema } from "../index";
import { ApiProvider } from "./context";
import { createQueryClient } from "./query-client";

export const ORG_ID = "0198a2c4-7b1e-7cc0-8000-0000000000a1";
export const NOW = Date.parse("2026-11-16T12:00:00Z");

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

export function me(fullName = "Morgan Member"): Schema<"MeResponse"> {
  return {
    id: "0198a2c4-7b1e-7cc0-8000-0000000000b1",
    email: "morgan@example.com",
    full_name: fullName,
    memberships: [
      {
        organization: { id: ORG_ID, name: "Lone Star Restoration", slug: "lone-star" },
        role: "owner",
        permissions: ["org:read", "org:update", "members:manage"],
      },
    ],
  };
}

export const CLAIM_ID = "0198a2c4-7b1e-7cc0-8000-0000000000d1";
export const CLAIM_NUMBER = "CF-2026-0042";
export const MORGAN = { id: "0198a2c4-7b1e-7cc0-8000-0000000000b1", full_name: "Morgan Member" };
export const RILEY = { id: "0198a2c4-7b1e-7cc0-8000-0000000000b2", full_name: "Riley Tech" };

/** A water claim on a house in Austin; `changes` override any field. */
export function claim(changes: Partial<Schema<"ClaimRead">> = {}): Schema<"ClaimRead"> {
  return {
    id: CLAIM_ID,
    number: CLAIM_NUMBER,
    status: "new",
    next_statuses: ["inspected", "on_hold", "cancelled"],
    loss_type: "water",
    loss_date: "2026-11-10",
    description: "Supply line burst under the kitchen sink",
    policy_number: null,
    carrier_name: null,
    carrier_claim_number: null,
    property: {
      id: "0198a2c4-7b1e-7cc0-8000-0000000000e1",
      address: {
        line1: "100 Congress Ave",
        line2: null,
        city: "Austin",
        region: "TX",
        postal_code: "78701",
        country: "US",
        formatted: "100 Congress Ave, Austin, TX 78701",
      },
      property_type: "residential",
      year_built: 1998,
      latitude: null,
      longitude: null,
      access_notes: null,
      created_at: "2026-11-10T15:00:00Z",
      updated_at: "2026-11-10T15:00:00Z",
    },
    contacts: [],
    assignments: [],
    created_by_id: MORGAN.id,
    created_at: "2026-11-10T15:00:00Z",
    updated_at: "2026-11-10T15:00:00Z",
    ...changes,
  };
}

export function tokenPair(n: number): Schema<"TokenResponse"> {
  return {
    access_token: `access-${String(n)}`,
    token_type: "bearer",
    expires_in: 900,
    refresh_token: `refresh-${String(n)}`,
    refresh_expires_at: "2026-12-16T12:00:00Z",
  };
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
}

/** `renderHook` inside a QueryClientProvider and an ApiProvider talking to `server`. */
export function renderWithApi<Result>(
  hook: () => Result,
  { server = new FakeServer(), tokens = memoryTokenStore(signedIn()) }: Rendered = {},
) {
  const api = createApiClient({
    baseUrl: "https://api.test",
    fetch: server.fetch,
    auth: { tokens, now: () => NOW },
  });
  const queryClient = createQueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ApiProvider client={api}>{children}</ApiProvider>
      </QueryClientProvider>
    );
  }
  return { ...renderHook(hook, { wrapper }), api, queryClient, server, tokens };
}
