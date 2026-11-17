import { useApi, queryKeys } from "@claimforge/api-client/react";
import { useQueries } from "@tanstack/react-query";

import type { ClaimStatus } from "../claims/status";

/** Counts stop here; past it the card says "100+". */
export const COUNT_LIMIT = 100;

export interface ClaimCount {
  status: ClaimStatus;
  /** Claims found, up to `COUNT_LIMIT`. */
  count: number;
  /** More than `count` exist. */
  more: boolean;
}

/**
 * How many claims have each status. The API has no count endpoint, so each count reads up
 * to `COUNT_LIMIT` claims of its status. The keys sit under the claim lists', so whatever
 * refreshes the lists after a claim changes refreshes these too.
 */
export function useClaimCounts(organizationId: string, statuses: ClaimStatus[]) {
  const api = useApi();
  return useQueries({
    queries: statuses.map((status) => ({
      queryKey: [...queryKeys.claimLists(organizationId), "count", status],
      queryFn: async ({ signal }: { signal: AbortSignal }): Promise<ClaimCount> => {
        const page = await api.get("/v1/organizations/{organization_id}/claims", {
          path: { organization_id: organizationId },
          query: { status: [status], limit: COUNT_LIMIT },
          signal,
        });
        return { status, count: page.items.length, more: page.has_more };
      },
    })),
  });
}
