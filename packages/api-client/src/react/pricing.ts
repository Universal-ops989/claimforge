/**
 * Price lists: the organization's rates (removal per square foot, a dehumidifier per day,
 * …) that estimate lines are priced from. Reading only for now; managing lists is item 119.
 */
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { QueryParams } from "../index";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { nextCursor } from "./pages";

const LISTS = "/v1/organizations/{organization_id}/price-lists";
const ITEMS = `${LISTS}/{list_id}/items` as const;

type ItemsQuery = Omit<QueryParams<typeof ITEMS, "get">, "cursor">;

/** The organization's price lists: the default first, then by name. */
export function priceListsQuery(api: ApiClient, organizationId: string) {
  return queryOptions({
    queryKey: queryKeys.priceLists(organizationId),
    queryFn: ({ signal }) => api.get(LISTS, { path: { organization_id: organizationId }, signal }),
  });
}

export function usePriceLists(organizationId: string) {
  return useQuery(priceListsQuery(useApi(), organizationId));
}

/** A list's items by code, a page at a time; `q` matches code or description. */
export function priceItemsQuery(
  api: ApiClient,
  organizationId: string,
  listId: string,
  query: ItemsQuery = {},
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.priceItems(organizationId, listId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(ITEMS, {
        path: { organization_id: organizationId, list_id: listId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function usePriceItems(organizationId: string, listId: string, query: ItemsQuery = {}) {
  return useInfiniteQuery(priceItemsQuery(useApi(), organizationId, listId, query));
}
