/**
 * The search box: an organization's claims and contacts that hold every word typed.
 *
 * Words match as prefixes, so results come while someone types; the last results stay
 * shown while the next ones load, so the list doesn't blink between keystrokes. A search
 * with no words (blank, or only punctuation) asks nothing and finds nothing.
 */
import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import type { ApiClient } from "../client";
import { useApi } from "./context";
import { queryKeys } from "./keys";

/** Whether `q` has a word in it: the API ignores everything else. */
export const hasSearchWords = (q: string) => /[\p{L}\p{N}_]/u.test(q);

export function searchQuery(api: ApiClient, organizationId: string, q: string, limit = 5) {
  const typed = q.trim();
  return queryOptions({
    queryKey: queryKeys.search(organizationId, typed, limit),
    queryFn: ({ signal }) =>
      api.get("/v1/organizations/{organization_id}/search", {
        path: { organization_id: organizationId },
        query: { q: typed, limit },
        signal,
      }),
    enabled: hasSearchWords(typed),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

/** Claims and contacts for `q`, up to `limit` of each (5 unless told; the API allows 25). */
export function useSearch(organizationId: string, q: string, limit = 5) {
  return useQuery(searchQuery(useApi(), organizationId, q, limit));
}
