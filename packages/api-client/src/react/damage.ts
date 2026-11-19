/**
 * Damage recorded in a claim's rooms: the floor, the drywall, the cabinets, each with its
 * material, cause and, for water, its IICRC category and class.
 *
 * A claim's damage items come as one list, grouped by room in the order the rooms were
 * added. Every change refetches that list (and the timeline) rather than editing it in
 * place: the API settles the cause and water category (flood and sewage water is always
 * Category 3), so its answer, not the request, is what to show.
 */
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { QueryParams, RequestBody } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";

const ITEMS = "/v1/organizations/{organization_id}/claims/{claim_id}/damage-items";
const ITEM = `${ITEMS}/{damage_item_id}` as const;
const ROOM_ITEMS =
  "/v1/organizations/{organization_id}/claims/{claim_id}/rooms/{room_id}/damage-items";

type DamageQuery = QueryParams<typeof ITEMS, "get">;

/** A claim's damage items, by room; `room_id` or `cause` narrow them. */
export function damageItemsQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: DamageQuery = {},
) {
  return queryOptions({
    queryKey: queryKeys.damageItemList(organizationId, claimId, query),
    queryFn: ({ signal }) =>
      api.get(ITEMS, {
        path: { organization_id: organizationId, claim_id: claimId },
        query,
        signal,
      }),
  });
}

export function useDamageItems(organizationId: string, claimId: string, query: DamageQuery = {}) {
  return useQuery(damageItemsQuery(useApi(), organizationId, claimId, query));
}

/** After any change: every damage list of the claim, and its timeline. */
function useRefresh(organizationId: string, claimId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [
        queryKeys.damageItems(organizationId, claimId),
        queryKeys.timelines(organizationId, claimId),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
}

export interface NewDamage {
  roomId: string;
  item: RequestBody<typeof ROOM_ITEMS, "post">;
}

/** Record damage in a room; `mutate({ roomId, item: { surface, material, … } })`. */
export function useRecordDamage(organizationId: string, claimId: string) {
  const api = useApi();
  const refresh = useRefresh(organizationId, claimId);
  return useMutation({
    mutationFn: ({ roomId, item }: NewDamage) =>
      api.post(ROOM_ITEMS, {
        path: { organization_id: organizationId, claim_id: claimId, room_id: roomId },
        body: item,
      }),
    onSuccess: refresh,
  });
}

export interface DamageChange {
  itemId: string;
  changes: RequestBody<typeof ITEM, "patch">;
}

/** Change a damage item, or move it to another room (`changes.room_id`). */
export function useUpdateDamageItem(organizationId: string, claimId: string) {
  const api = useApi();
  const refresh = useRefresh(organizationId, claimId);
  return useMutation({
    mutationFn: ({ itemId, changes }: DamageChange) =>
      api.patch(ITEM, {
        path: { organization_id: organizationId, claim_id: claimId, damage_item_id: itemId },
        body: changes,
      }),
    onSuccess: refresh,
  });
}

export function useDeleteDamageItem(organizationId: string, claimId: string) {
  const api = useApi();
  const refresh = useRefresh(organizationId, claimId);
  return useMutation({
    mutationFn: (itemId: string) =>
      api.delete(ITEM, {
        path: { organization_id: organizationId, claim_id: claimId, damage_item_id: itemId },
      }),
    onSuccess: refresh,
  });
}
