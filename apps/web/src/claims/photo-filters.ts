import type { QueryParams } from "@claimforge/api-client";

/** Which photos to show: all, a room's, or those in no room; and tags they must all carry. */
export interface PhotoFilters {
  /** A room's id, `"none"` for photos in no room, or `null` for every room. */
  room: string | null;
  tags: string[];
}

export type PhotosQuery = Omit<
  QueryParams<"/v1/organizations/{organization_id}/claims/{claim_id}/photos", "get">,
  "cursor"
>;

export const NO_PHOTO_FILTERS: PhotoFilters = { room: null, tags: [] };

/** The filters in an address: `?room=…&tag=before&tag=ceiling`. */
export function readPhotoFilters(params: URLSearchParams): PhotoFilters {
  const tags = params
    .getAll("tag")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  const room = (params.get("room") ?? "").trim();
  return { room: room === "" ? null : room, tags: [...new Set(tags)].sort() };
}

/** `params` with `filters` written in; anything else in the address stays. */
export function writePhotoFilters(params: URLSearchParams, filters: PhotoFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("room");
  next.delete("tag");
  if (filters.room) next.set("room", filters.room);
  for (const tag of filters.tags) next.append("tag", tag);
  return next;
}

export function hasPhotoFilters(filters: PhotoFilters): boolean {
  return filters.room !== null || filters.tags.length > 0;
}

/** The API query for `filters`. */
export function photoFiltersQuery(filters: PhotoFilters): PhotosQuery {
  return {
    ...(filters.room === "none"
      ? { unassigned: true }
      : filters.room
        ? { room_id: filters.room }
        : {}),
    ...(filters.tags.length ? { tag: filters.tags } : {}),
  };
}

/** `filters` with `tag` turned on or off. */
export function toggleTag(filters: PhotoFilters, tag: string): PhotoFilters {
  const tags = filters.tags.includes(tag)
    ? filters.tags.filter((t) => t !== tag)
    : [...filters.tags, tag].sort();
  return { ...filters, tags };
}
