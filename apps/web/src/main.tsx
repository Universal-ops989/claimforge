import "@claimforge/ui/styles.css";

import { createQueryClient } from "@claimforge/api-client/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

import { createAppApiClient } from "./api/client";
import { Providers } from "./app/providers";
import { createSessionStore } from "./auth/session-store";
import { config } from "./config";
import { routes } from "./routes";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html has no #root element");
}

// Spelled out (not `config.mockApi`) so Vite replaces it at build time and production
// bundles drop the mock entirely.
if (import.meta.env.VITE_API_MOCK === "true") {
  const { startMockApi } = await import("./mocks/browser");
  await startMockApi(config.apiUrl);
}

const session = createSessionStore(storageOrNull());
const api = createAppApiClient(config, session);
const queryClient = createQueryClient();
const router = createBrowserRouter(routes);

createRoot(root).render(
  <StrictMode>
    <Providers api={api} queryClient={queryClient} session={session}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);

/** `localStorage`, unless the browser refuses it (some private modes throw on access). */
function storageOrNull(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
