/**
 * Drying equipment: the organization's fleet (dehumidifiers, air movers, …) and where
 * each unit is placed on a claim.
 *
 * A placement touches several views at once: the claim's placements and billable days,
 * the fleet (each unit carries its current placement), drying status (which flags units
 * still running in a dry room) and the timeline. Every change refreshes them all rather
 * than editing one in place: days and alerts are the API's to work out.
 */
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { QueryParams, RequestBody } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { nextCursor } from "./pages";

const FLEET = "/v1/organizations/{organization_id}/equipment";
const UNIT = `${FLEET}/{equipment_id}` as const;
const CLAIM = "/v1/organizations/{organization_id}/claims/{claim_id}";
const PLACEMENTS = `${CLAIM}/equipment-placements` as const;
const PLACEMENT = `${PLACEMENTS}/{placement_id}` as const;
const DAYS = `${CLAIM}/equipment-days` as const;

type FleetQuery = Omit<QueryParams<typeof FLEET, "get">, "cursor">;
type PlacementsQuery = QueryParams<typeof PLACEMENTS, "get">;

// ─── The fleet ───────────────────────────────────────────────────────────────

/** The organization's equipment by asset tag; `available: true` for units free to place. */
export function equipmentQuery(api: ApiClient, organizationId: string, query: FleetQuery = {}) {
  return infiniteQueryOptions({
    queryKey: queryKeys.equipmentList(organizationId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(FLEET, {
        path: { organization_id: organizationId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useEquipment(organizationId: string, query: FleetQuery = {}) {
  return useInfiniteQuery(equipmentQuery(useApi(), organizationId, query));
}

function useRefreshFleet(organizationId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.equipment(organizationId) });
}

export function useCreateEquipment(organizationId: string) {
  const api = useApi();
  const refresh = useRefreshFleet(organizationId);
  return useMutation({
    mutationFn: (body: RequestBody<typeof FLEET, "post">) =>
      api.post(FLEET, { path: { organization_id: organizationId }, body }),
    onSuccess: refresh,
  });
}

export interface EquipmentChange {
  equipmentId: string;
  changes: RequestBody<typeof UNIT, "patch">;
}

/** Edit a unit; `status: "maintenance"` while it's repaired, `"retired"` when it leaves. */
export function useUpdateEquipment(organizationId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ equipmentId, changes }: EquipmentChange) =>
      api.patch(UNIT, {
        path: { organization_id: organizationId, equipment_id: equipmentId },
        body: changes,
      }),
    // Claims show units by name and tag: their placements refresh too.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.organization(organizationId) }),
  });
}

/** Delete a unit added by mistake; one that has worked jobs is refused (`equipment_has_history`). */
export function useDeleteEquipment(organizationId: string) {
  const api = useApi();
  const refresh = useRefreshFleet(organizationId);
  return useMutation({
    mutationFn: (equipmentId: string) =>
      api.delete(UNIT, { path: { organization_id: organizationId, equipment_id: equipmentId } }),
    onSuccess: refresh,
  });
}

// ─── Placements ──────────────────────────────────────────────────────────────

/** A claim's placements, in the order units were placed; `running: true` for what's on site. */
export function placementsQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: PlacementsQuery = {},
) {
  return queryOptions({
    queryKey: queryKeys.placementList(organizationId, claimId, query),
    queryFn: ({ signal }) =>
      api.get(PLACEMENTS, {
        path: { organization_id: organizationId, claim_id: claimId },
        query,
        signal,
      }),
  });
}

export function usePlacements(
  organizationId: string,
  claimId: string,
  query: PlacementsQuery = {},
) {
  return useQuery(placementsQuery(useApi(), organizationId, claimId, query));
}

/** Billable equipment-days by kind: what the estimate charges. */
export function equipmentDaysQuery(api: ApiClient, organizationId: string, claimId: string) {
  return queryOptions({
    queryKey: queryKeys.equipmentDays(organizationId, claimId),
    queryFn: ({ signal }) =>
      api.get(DAYS, { path: { organization_id: organizationId, claim_id: claimId }, signal }),
  });
}

export function useEquipmentDays(organizationId: string, claimId: string) {
  return useQuery(equipmentDaysQuery(useApi(), organizationId, claimId));
}

/** After any placement change: everything that shows where units are and for how long. */
function useRefreshPlacements(organizationId: string, claimId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [
        queryKeys.placements(organizationId, claimId),
        queryKeys.equipmentDays(organizationId, claimId),
        queryKeys.equipment(organizationId),
        queryKeys.drying(organizationId, claimId),
        queryKeys.timelines(organizationId, claimId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

/** Place a unit in a room; `placed_at` defaults to now and can be earlier. */
export function usePlaceEquipment(organizationId: string, claimId: string) {
  const api = useApi();
  const refresh = useRefreshPlacements(organizationId, claimId);
  return useMutation({
    mutationFn: (body: RequestBody<typeof PLACEMENTS, "post">) =>
      api.post(PLACEMENTS, { path: { organization_id: organizationId, claim_id: claimId }, body }),
    onSuccess: refresh,
  });
}

export interface PlacementChange {
  placementId: string;
  changes: RequestBody<typeof PLACEMENT, "patch">;
}

/** Correct a placement's room or times; `removed_at: null` puts a unit back to running. */
export function useUpdatePlacement(organizationId: string, claimId: string) {
  const api = useApi();
  const refresh = useRefreshPlacements(organizationId, claimId);
  return useMutation({
    mutationFn: ({ placementId, changes }: PlacementChange) =>
      api.patch(PLACEMENT, {
        path: { organization_id: organizationId, claim_id: claimId, placement_id: placementId },
        body: changes,
      }),
    onSuccess: refresh,
  });
}

/** Pull a unit off the job (now, or `removed_at`). Works on closed claims too. */
export function useRemoveEquipment(organizationId: string, claimId: string) {
  const api = useApi();
  const refresh = useRefreshPlacements(organizationId, claimId);
  return useMutation({
    mutationFn: ({ placementId, removed_at }: { placementId: string; removed_at?: string }) =>
      api.post(`${PLACEMENT}/remove`, {
        path: { organization_id: organizationId, claim_id: claimId, placement_id: placementId },
        body: removed_at ? { removed_at } : {},
      }),
    onSuccess: refresh,
  });
}

/** Delete a placement entered by mistake: it stops counting towards billing. */
export function useDeletePlacement(organizationId: string, claimId: string) {
  const api = useApi();
  const refresh = useRefreshPlacements(organizationId, claimId);
  return useMutation({
    mutationFn: (placementId: string) =>
      api.delete(PLACEMENT, {
        path: { organization_id: organizationId, claim_id: claimId, placement_id: placementId },
      }),
    onSuccess: refresh,
  });
}
