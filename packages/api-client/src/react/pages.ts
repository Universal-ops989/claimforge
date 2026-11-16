import type { InfiniteData } from "@tanstack/react-query";

import type { CursorPage } from "../index";

/** `getNextPageParam` for every cursor-paginated list: the next cursor, or none on the last page. */
export function nextCursor(page: CursorPage<unknown>): string | undefined {
  return page.has_more && page.next_cursor !== null ? page.next_cursor : undefined;
}

/** Every item loaded so far by an infinite query, in order. */
export function allItems<Item>(data: InfiniteData<CursorPage<Item>> | undefined): Item[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}
