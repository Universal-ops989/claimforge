import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

import { ApiError, NetworkError } from "../errors";

/** Attempts after the first, for queries that failed for a passing reason. */
export const MAX_RETRIES = 3;

/**
 * Whether a failed query is worth another try: yes for no answer at all, 5xx, 429 and
 * 408; never for other 4xx (asking again gets the same answer) or a body that failed
 * validation (the build and the API disagree, and retrying won't fix that).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) {
    return false;
  }
  if (error instanceof NetworkError) {
    return true;
  }
  if (error instanceof ApiError) {
    return error.status >= 500 || error.status === 429 || error.status === 408;
  }
  return false;
}

/**
 * A `QueryClient` with defaults that fit the API: `shouldRetry` for queries, no retries
 * for mutations (they aren't all safe to repeat), and data fresh for 30 seconds.
 * Anything passed in wins.
 */
export function createQueryClient(config: QueryClientConfig = {}): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config.defaultOptions,
      queries: { retry: shouldRetry, staleTime: 30_000, ...config.defaultOptions?.queries },
      mutations: { retry: false, ...config.defaultOptions?.mutations },
    },
  });
}
