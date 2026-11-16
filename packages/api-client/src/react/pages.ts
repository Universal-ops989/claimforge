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
