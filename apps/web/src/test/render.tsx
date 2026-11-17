/**
 * Render the app (or any routes) the way it runs: the real providers and API client,
 * talking to the in-memory mock backend through `msw/node` (see setup.ts).
 */
import type { ApiClient } from "@claimforge/api-client";
import { createMockBackend, MOCK_PASSWORD } from "@claimforge/api-client/msw";
import { createQueryClient } from "@claimforge/api-client/react";
import { render } from "@testing-library/react";
import { setupServer } from "msw/node";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";

import { createAppApiClient } from "../api/client";
import { Providers } from "../app/providers";
import { routes as appRoutes } from "../routes";

export const API_URL = "https://api.test";

/** The mock backend every test talks to; reset after each test. */
export const backend = createMockBackend({ baseUrl: API_URL });
export const server = setupServer(...backend.handlers);

export interface RenderAppOptions {
  /** Sign in first, as this mock account. */
  signedInAs?: "morgan@example.com" | "riley@example.com";
  /** Routes to render instead of the app's. */
  routes?: RouteObject[];
}

export async function renderApp(path: string, options: RenderAppOptions = {}) {
  const api: ApiClient = createAppApiClient({
    apiUrl: API_URL,
    mockApi: false,
    production: false,
  });
  if (options.signedInAs) {
    await api.login({ email: options.signedInAs, password: MOCK_PASSWORD });
  }
  const queryClient = createQueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(options.routes ?? appRoutes, { initialEntries: [path] });
  const rendered = render(
    <Providers api={api} queryClient={queryClient} themeStorageKey={null}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...rendered, api, queryClient, router };
}
