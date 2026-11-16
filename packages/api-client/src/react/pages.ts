import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

import type { CursorPage } from "../index";

/** `getNextPageParam` for every cursor-paginated list: the next cursor, or none on the last page. */
export function nextCursor(page: CursorPage<unknown>): string | undefined {
  return page.has_more && page.next_cursor !== null ? page.next_cursor : undefined;
}

/** Every item loaded so far by an infinite query, in order. */
export function allItems<Item>(data: InfiniteData<CursorPage<Item>> | undefined): Item[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

/**
 * Edit the loaded pages of an infinite query in place: `edit` gets each page's items and
 * its index (0 is the first page). Page cursors are left alone, so loading more still
 * continues where the API left off.
 */
export function editPages<Item>(
  data: InfiniteData<CursorPage<Item>> | undefined,
  edit: (items: Item[], index: number) => Item[],
): InfiniteData<CursorPage<Item>> | undefined {
  return (
    data && {
      ...data,
      pages: data.pages.map((page, index) => ({ ...page, items: edit(page.items, index) })),
    }
  );
}

/**
 * Bring every cached list under `prefix` (keys ending in the list's filters) in line with
 * a change: lists `filtered` says are unfiltered are edited in place with `edit`; the
 * others are refetched, because whether the item belongs in them is the API's call.
 */
// `Query` names what the key's last element holds; reading it back out is unchecked.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export async function editOrRefetch<Item, Query>(
  queryClient: QueryClient,
  prefix: QueryKey,
  filtered: (query: Query) => boolean,
  edit: (items: Item[], index: number) => Item[],
): Promise<void> {
  const refetch: Promise<void>[] = [];
  for (const [queryKey] of queryClient.getQueriesData({ queryKey: prefix })) {
    if (filtered(queryKey[queryKey.length - 1] as Query)) {
      refetch.push(queryClient.invalidateQueries({ queryKey, exact: true }));
    } else {
      queryClient.setQueryData<InfiniteData<CursorPage<Item>>>(queryKey, (pages) =>
        editPages(pages, edit),
      );
    }
  }
  await Promise.all(refetch);
}
