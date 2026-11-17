import { createMockBackend } from "@claimforge/api-client/msw";
import { setupWorker } from "msw/browser";

import { DEMO_ACCOUNT } from "./demo-account";

/**
 * Serve the API from the in-memory mock backend, inside the browser, for `VITE_API_MOCK=true`.
 * Sign in as morgan@example.com or riley@example.com with `MOCK_PASSWORD`. Only this mode
 * imports the file, so production bundles don't contain it. Everything lives in the page:
 * a reload starts over.
 */
export async function startMockApi(apiUrl: string): Promise<void> {
  const backend = createMockBackend({ baseUrl: apiUrl });
  const worker = setupWorker(...backend.handlers);
  await worker.start({
    // Next to the app, wherever it's served (`public/` lands under Vite's `base`).
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    onUnhandledFrame: "bypass",
    quiet: true,
  });
  console.warn(
    `%cClaimForge is using the mock API. Sign in as ${DEMO_ACCOUNT.email}.`,
    "font-weight: bold",
  );
}
