import { createApiClient, webLock, type ApiClient, type TokenStore } from "@claimforge/api-client";

import type { AppConfig } from "../config";

/**
 * The app's one API client. Contract mismatches fail loudly in development and are only
 * reported in production, where an older build may meet a newer API. Tabs take turns
 * refreshing the session (`webLock`), since the API revokes a refresh token used twice.
 *
 * The session's tokens are kept in `tokens` (the app's `SessionStore`).
 */
export function createAppApiClient(config: AppConfig, tokens: TokenStore): ApiClient {
  return createApiClient({
    baseUrl: config.apiUrl,
    auth: { tokens, lock: webLock() },
    validate: config.production ? "report" : "throw",
    onInvalidResponse: (error) => {
      console.warn(error.message);
    },
  });
}
