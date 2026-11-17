import { createApiClient, memoryTokenStore, webLock, type ApiClient } from "@claimforge/api-client";

import type { AppConfig } from "../config";

/**
 * The app's one API client. Contract mismatches fail loudly in development and are only
 * reported in production, where an older build may meet a newer API. Tabs take turns
 * refreshing the session (`webLock`), since the API revokes a refresh token used twice.
 *
 * Tokens live in memory for now; keeping a session across reloads comes with sign-in.
 */
export function createAppApiClient(config: AppConfig): ApiClient {
  return createApiClient({
    baseUrl: config.apiUrl,
    auth: { tokens: memoryTokenStore(), lock: webLock() },
    validate: config.production ? "report" : "throw",
    onInvalidResponse: (error) => {
      console.warn(error.message);
    },
  });
}
