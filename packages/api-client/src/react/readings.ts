/**
 * Moisture mapping and monitoring: the points mapped on a claim, the visits (logs) that
 * read them, and the drying log and status the API computes from both.
 *
 * Any change to a point or a visit makes the computed views stale, so it refreshes them
 * (`queryKeys.drying` covers both). Lists are refetched rather than re-sorted here: points
 * sort by room and then by label as people number them ("2" before "10"), and visits by
 * when they were taken, which can be backdated. Details are written from the answer.
 */
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { CursorPage, QueryParams, RequestBody, Schema } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { editPages, nextCursor } from "./pages";

type Log = Schema<"MoistureLogRead">;

const CLAIM = "/v1/organizations/{organization_id}/claims/{claim_id}";
const POINTS = `${CLAIM}/moisture-points` as const;
const POINT = `${POINTS}/{point_id}` as const;
const LOGS = `${CLAIM}/moisture-logs` as const;
const LOG = `${LOGS}/{log_id}` as const;
const DRYING_LOG = `${CLAIM}/drying-log` as const;
const DRYING_STATUS = `${CLAIM}/drying-status` as const;

type PointsQuery = QueryParams<typeof POINTS, "get">;
type LogsQuery = Omit<QueryParams<typeof LOGS, "get">, "cursor">;
type DryingLogQuery = QueryParams<typeof DRYING_LOG, "get">;

// ─── Reading ─────────────────────────────────────────────────────────────────

/** A claim's moisture points, room by room; `{ room_id }` narrows to one room. */
export function moisturePointsQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: PointsQuery = {},
) {
  return queryOptions({
    queryKey: queryKeys.moisturePointList(organizationId, claimId, query),
    queryFn: ({ signal }) =>
      api.get(POINTS, {
        path: { organization_id: organizationId, claim_id: claimId },
        query,
        signal,
      }),
  });
}

export function useMoisturePoints(
  organizationId: string,
  claimId: string,
  query: PointsQuery = {},
) {
  return useQuery(moisturePointsQuery(useApi(), organizationId, claimId, query));
}

export function moisturePointQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  pointId: string,
) {
  return queryOptions({
    queryKey: queryKeys.moisturePoint(organizationId, claimId, pointId),
    queryFn: ({ signal }) =>
      api.get(POINT, {
        path: { organization_id: organizationId, claim_id: claimId, point_id: pointId },
        signal,
      }),
  });
}

export function useMoisturePoint(organizationId: string, claimId: string, pointId: string) {
  return useQuery(moisturePointQuery(useApi(), organizationId, claimId, pointId));
}

/** Monitoring visits, most recent first, a page at a time. */
export function moistureLogsQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: LogsQuery = {},
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.moistureLogList(organizationId, claimId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(LOGS, {
        path: { organization_id: organizationId, claim_id: claimId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useMoistureLogs(organizationId: string, claimId: string, query: LogsQuery = {}) {
  return useInfiniteQuery(moistureLogsQuery(useApi(), organizationId, claimId, query));
}

export function moistureLogQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  logId: string,
) {
  return queryOptions({
    queryKey: queryKeys.moistureLog(organizationId, claimId, logId),
    queryFn: ({ signal }) =>
      api.get(LOG, {
        path: { organization_id: organizationId, claim_id: claimId, log_id: logId },
        signal,
      }),
  });
}

export function useMoistureLog(organizationId: string, claimId: string, logId: string) {
  return useQuery(moistureLogQuery(useApi(), organizationId, claimId, logId));
}

/** The monitoring table: each point's readings by visit, oldest first, then the air. */
export function dryingLogQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: DryingLogQuery = {},
) {
  return queryOptions({
    queryKey: queryKeys.dryingLog(organizationId, claimId, query),
    queryFn: ({ signal }) =>
      api.get(DRYING_LOG, {
        path: { organization_id: organizationId, claim_id: claimId },
        query,
        signal,
      }),
  });
}

export function useDryingLog(organizationId: string, claimId: string, query: DryingLogQuery = {}) {
  return useQuery(dryingLogQuery(useApi(), organizationId, claimId, query));
}

/** Where drying stands on the claim, and what needs attention now. */
export function dryingStatusQuery(api: ApiClient, organizationId: string, claimId: string) {
  return queryOptions({
    queryKey: queryKeys.dryingStatus(organizationId, claimId),
    queryFn: ({ signal }) =>
      api.get(DRYING_STATUS, {
        path: { organization_id: organizationId, claim_id: claimId },
        signal,
      }),
  });
}

export function useDryingStatus(organizationId: string, claimId: string) {
  return useQuery(dryingStatusQuery(useApi(), organizationId, claimId));
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

/** Refetch `lists` and what every reading change makes stale: drying and the timeline. */
async function refresh(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  lists: QueryKey,
): Promise<void> {
  await Promise.all(
    [
      lists,
      queryKeys.drying(organizationId, claimId),
      queryKeys.timelines(organizationId, claimId),
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

// ─── Moisture points ─────────────────────────────────────────────────────────

/** Map a point in a room; its label defaults to the next number. */
export function useCreateMoisturePoint(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof POINTS, "post">) =>
      api.post(POINTS, { path: { organization_id: organizationId, claim_id: claimId }, body }),
    onSuccess: async (created) => {
      queryClient.setQueryData(
        moisturePointQuery(api, organizationId, claimId, created.id).queryKey,
        created,
      );
      await refresh(
        queryClient,
        organizationId,
        claimId,
        queryKeys.moisturePointLists(organizationId, claimId),
      );
    },
  });
}

export interface MoisturePointChange {
  pointId: string;
  changes: RequestBody<typeof POINT, "patch">;
}

/** Relabel, re-describe, set the dry goal of, or move (`room_id`) a point. */
export function useUpdateMoisturePoint(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pointId, changes }: MoisturePointChange) =>
      api.patch(POINT, {
        path: { organization_id: organizationId, claim_id: claimId, point_id: pointId },
        body: changes,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(
        moisturePointQuery(api, organizationId, claimId, updated.id).queryKey,
        updated,
      );
      await refresh(
        queryClient,
        organizationId,
        claimId,
        queryKeys.moisturePointLists(organizationId, claimId),
      );
    },
  });
}

/** Delete a point with all its readings, which also leave every visit. */
export function useDeleteMoisturePoint(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pointId: string) =>
      api.delete(POINT, {
        path: { organization_id: organizationId, claim_id: claimId, point_id: pointId },
      }),
    onSuccess: async (_, pointId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.moisturePoint(organizationId, claimId, pointId),
      });
      await Promise.all([
        refresh(
          queryClient,
          organizationId,
          claimId,
          queryKeys.moisturePointLists(organizationId, claimId),
        ),
        // Visits list their readings, and this point's are gone.
        queryClient.invalidateQueries({
          queryKey: queryKeys.moistureLogs(organizationId, claimId),
        }),
      ]);
    },
  });
}

// ─── Monitoring visits ───────────────────────────────────────────────────────

/** Record a visit: the readings of each point and the air, taken now or at `taken_at`. */
export function useCreateMoistureLog(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestBody<typeof LOGS, "post">) =>
      api.post(LOGS, { path: { organization_id: organizationId, claim_id: claimId }, body }),
    onSuccess: async (created) => {
      queryClient.setQueryData(
        moistureLogQuery(api, organizationId, claimId, created.id).queryKey,
        created,
      );
      await refresh(
        queryClient,
        organizationId,
        claimId,
        queryKeys.moistureLogLists(organizationId, claimId),
      );
    },
  });
}

export interface MoistureLogChange {
  logId: string;
  changes: RequestBody<typeof LOG, "patch">;
}

/** Correct a visit: its time, notes, or readings (a `null` value removes a reading). */
export function useUpdateMoistureLog(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ logId, changes }: MoistureLogChange) =>
      api.patch(LOG, {
        path: { organization_id: organizationId, claim_id: claimId, log_id: logId },
        body: changes,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(
        moistureLogQuery(api, organizationId, claimId, updated.id).queryKey,
        updated,
      );
      await refresh(
        queryClient,
        organizationId,
        claimId,
        queryKeys.moistureLogLists(organizationId, claimId),
      );
    },
  });
}

/** Delete a visit and its readings. It leaves the loaded pages at once. */
export function useDeleteMoistureLog(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (logId: string) =>
      api.delete(LOG, {
        path: { organization_id: organizationId, claim_id: claimId, log_id: logId },
      }),
    onSuccess: async (_, logId) => {
      queryClient.removeQueries({
        queryKey: queryKeys.moistureLog(organizationId, claimId, logId),
      });
      queryClient.setQueriesData<InfiniteData<CursorPage<Log>>>(
        { queryKey: queryKeys.moistureLogLists(organizationId, claimId) },
        (pages) => editPages(pages, (logs) => logs.filter((log) => log.id !== logId)),
      );
      await Promise.all(
        [
          queryKeys.drying(organizationId, claimId),
          queryKeys.timelines(organizationId, claimId),
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });
}
