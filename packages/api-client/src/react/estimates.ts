/**
 * Estimates: their lines, totals and approval.
 *
 * Every change answers with the whole estimate, totals recomputed, so the detail and its
 * summary in the claim's list are written from the answer and line editing costs no
 * refetch. Quick edits (a quantity typed into a line grid) can be answered out of order;
 * the copy with the later `updated_at` wins, so an older answer never overwrites a newer
 * one. If someone submitted the estimate meanwhile, the API refuses changes with 409
 * `estimate_not_draft`, and the estimate is refetched so the screen shows it locked.
 */
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import { isApiError } from "../errors";
import type { RequestBody, Schema } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";

type Estimate = Schema<"EstimateRead">;
type Summary = Schema<"EstimateSummary">;

const ESTIMATES = "/v1/organizations/{organization_id}/claims/{claim_id}/estimates";
const ESTIMATE = `${ESTIMATES}/{estimate_id}` as const;
const LINES = `${ESTIMATE}/lines` as const;
const LINE = `${LINES}/{line_id}` as const;
const STATUS = `${ESTIMATE}/status` as const;

// ─── Reading ─────────────────────────────────────────────────────────────────

/** A claim's estimates, by number. */
export function estimatesQuery(api: ApiClient, organizationId: string, claimId: string) {
  return queryOptions({
    queryKey: queryKeys.estimateList(organizationId, claimId),
    queryFn: ({ signal }) =>
      api.get(ESTIMATES, {
        path: { organization_id: organizationId, claim_id: claimId },
        signal,
      }),
  });
}

export function useEstimates(organizationId: string, claimId: string) {
  return useQuery(estimatesQuery(useApi(), organizationId, claimId));
}

export function estimateQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  estimateId: string,
) {
  return queryOptions({
    queryKey: queryKeys.estimate(organizationId, claimId, estimateId),
    queryFn: ({ signal }) =>
      api.get(ESTIMATE, {
        path: { organization_id: organizationId, claim_id: claimId, estimate_id: estimateId },
        signal,
      }),
  });
}

/** One estimate with its lines, room subtotals and totals. */
export function useEstimate(organizationId: string, claimId: string, estimateId: string) {
  return useQuery(estimateQuery(useApi(), organizationId, claimId, estimateId));
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

/** Whether `incoming` is at least as new as `cached` (no cached copy: yes). */
function newer(incoming: { updated_at: string }, cached: { updated_at: string } | undefined) {
  return cached === undefined || Date.parse(incoming.updated_at) >= Date.parse(cached.updated_at);
}

function summarize(estimate: Estimate): Summary {
  const { id, claim_id, number, title, status, total, created_at, updated_at } = estimate;
  return { id, claim_id, number, title, status, total, created_at, updated_at };
}

/**
 * Write an estimate the API answered with into its detail and the list, unless a newer
 * copy is already there. The list keeps the API's order, by number.
 */
function writeEstimate(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  estimate: Estimate,
): void {
  queryClient.setQueryData<Estimate>(
    queryKeys.estimate(organizationId, claimId, estimate.id),
    (cached) => (newer(estimate, cached) ? estimate : cached),
  );
  queryClient.setQueryData<Summary[]>(queryKeys.estimateList(organizationId, claimId), (list) => {
    if (!list) {
      return list;
    }
    const cached = list.find((summary) => summary.id === estimate.id);
    if (!newer(estimate, cached)) {
      return list;
    }
    return [...list.filter((summary) => summary.id !== estimate.id), summarize(estimate)].sort(
      (a, b) => a.number - b.number,
    );
  });
}

/**
 * The shared options of every estimate change: write the answer, refresh the timeline,
 * and on `estimate_not_draft` refetch what this client wrongly thinks is still a draft.
 */
function changes(queryClient: QueryClient, organizationId: string, claimId: string) {
  return {
    onSuccess: async (estimate: Estimate) => {
      writeEstimate(queryClient, organizationId, claimId, estimate);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.timelines(organizationId, claimId),
      });
    },
    onError: async (error: Error) => {
      if (isApiError(error, "estimate_not_draft")) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.estimates(organizationId, claimId),
        });
      }
    },
  };
}

// ─── Estimates ───────────────────────────────────────────────────────────────

/** Start an estimate; rates default to the organization's. */
export function useCreateEstimate(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof ESTIMATES, "post">) =>
      api.post(ESTIMATES, { path: { organization_id: organizationId, claim_id: claimId }, body }),
    ...changes(queryClient, organizationId, claimId),
  });
}

/** Retitle a draft, or change its rates or price list. */
export function useUpdateEstimate(organizationId: string, claimId: string, estimateId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof ESTIMATE, "patch">) =>
      api.patch(ESTIMATE, {
        path: { organization_id: organizationId, claim_id: claimId, estimate_id: estimateId },
        body,
      }),
    ...changes(queryClient, organizationId, claimId),
  });
}

/** Move an estimate on (`estimate.next_statuses` says where it can go). */
export function useChangeEstimateStatus(
  organizationId: string,
  claimId: string,
  estimateId: string,
) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (status: Schema<"EstimateStatus">) =>
      api.post(STATUS, {
        path: { organization_id: organizationId, claim_id: claimId, estimate_id: estimateId },
        body: { status },
      }),
    ...changes(queryClient, organizationId, claimId),
  });
}

/** Delete a draft; what was sent to a carrier stays on record. */
export function useDeleteEstimate(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const { onError } = changes(queryClient, organizationId, claimId);
  return useMutation({
    mutationFn: (estimateId: string) =>
      api.delete(ESTIMATE, {
        path: { organization_id: organizationId, claim_id: claimId, estimate_id: estimateId },
      }),
    onSuccess: async (_, estimateId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.estimate(organizationId, claimId, estimateId),
      });
      queryClient.setQueryData<Summary[]>(queryKeys.estimateList(organizationId, claimId), (list) =>
        list?.filter((summary) => summary.id !== estimateId),
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.timelines(organizationId, claimId),
      });
    },
    onError,
  });
}

// ─── Lines ───────────────────────────────────────────────────────────────────

/** Add a line from the price list (`price_item_id`) or by hand. */
export function useAddLine(organizationId: string, claimId: string, estimateId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof LINES, "post">) =>
      api.post(LINES, {
        path: { organization_id: organizationId, claim_id: claimId, estimate_id: estimateId },
        body,
      }),
    ...changes(queryClient, organizationId, claimId),
  });
}

export interface LineChange {
  lineId: string;
  changes: RequestBody<typeof LINE, "patch">;
}

/** Change a line: quantity, price, room, or `position` to reorder. */
export function useUpdateLine(organizationId: string, claimId: string, estimateId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, changes: body }: LineChange) =>
      api.patch(LINE, {
        path: {
          organization_id: organizationId,
          claim_id: claimId,
          estimate_id: estimateId,
          line_id: lineId,
        },
        body,
      }),
    ...changes(queryClient, organizationId, claimId),
  });
}

export function useDeleteLine(organizationId: string, claimId: string, estimateId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineId: string) =>
      api.delete(LINE, {
        path: {
          organization_id: organizationId,
          claim_id: claimId,
          estimate_id: estimateId,
          line_id: lineId,
        },
      }),
    ...changes(queryClient, organizationId, claimId),
  });
}
