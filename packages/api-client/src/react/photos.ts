/**
 * A claim's photos, and the organization's photo tags.
 *
 * Lists are newest first. A finished upload goes on top of the unfiltered lists; lists
 * filtered by room, tag or "unassigned" are refetched, since whether the photo belongs in
 * them is the API's call. Thumbnails are made after the upload, so while any photo shown
 * is still `pending` its list (or detail) asks again every few seconds.
 */
import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { ApiClient } from "../client";
import type { QueryParams, RequestBody, Schema } from "../index";
import { schemas } from "../zod.gen";
import { useApi } from "./context";
import { queryKeys } from "./keys";
import { editOrRefetch, nextCursor } from "./pages";
import { uploadFile, type FileFacts } from "./upload";

type Photo = Schema<"PhotoRead">;

const PHOTOS = "/v1/organizations/{organization_id}/claims/{claim_id}/photos";
const PHOTO = `${PHOTOS}/{photo_id}` as const;
const UPLOADS = "/v1/organizations/{organization_id}/claims/{claim_id}/photo-uploads";
const TAGS = "/v1/organizations/{organization_id}/photo-tags";

type PhotosQuery = Omit<QueryParams<typeof PHOTOS, "get">, "cursor">;
type TagsQuery = QueryParams<typeof TAGS, "get">;

/** How often photos still being processed are asked for again. */
export const PROCESSING_POLL_MS = 3_000;

const processing = (photo: Photo) => photo.processing === "pending";

// ─── Reading ─────────────────────────────────────────────────────────────────

export function photosQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  query: PhotosQuery = {},
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.photoList(organizationId, claimId, query),
    queryFn: ({ pageParam, signal }) =>
      api.get(PHOTOS, {
        path: { organization_id: organizationId, claim_id: claimId },
        query: { ...query, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    refetchInterval: ({ state }) =>
      state.data?.pages.some((page) => page.items.some(processing)) ? PROCESSING_POLL_MS : false,
  });
}

/** Pages of photos, newest first; filter by `room_id`, `unassigned` or `tag`. */
export function usePhotos(organizationId: string, claimId: string, query: PhotosQuery = {}) {
  return useInfiniteQuery(photosQuery(useApi(), organizationId, claimId, query));
}

export function photoQuery(
  api: ApiClient,
  organizationId: string,
  claimId: string,
  photoId: string,
) {
  return queryOptions({
    queryKey: queryKeys.photo(organizationId, claimId, photoId),
    queryFn: ({ signal }) =>
      api.get(PHOTO, {
        path: { organization_id: organizationId, claim_id: claimId, photo_id: photoId },
        signal,
      }),
    refetchInterval: ({ state }) =>
      state.data && processing(state.data) ? PROCESSING_POLL_MS : false,
  });
}

export function usePhoto(organizationId: string, claimId: string, photoId: string) {
  return useQuery(photoQuery(useApi(), organizationId, claimId, photoId));
}

/** The organization's photo tags, most used first. */
export function photoTagsQuery(api: ApiClient, organizationId: string, query: TagsQuery = {}) {
  return queryOptions({
    queryKey: queryKeys.photoTags(organizationId, query),
    queryFn: ({ signal }) =>
      api.get(TAGS, { path: { organization_id: organizationId }, query, signal }),
  });
}

/** Tag suggestions for `{ prefix }`; the last answer stays shown while the next loads. */
export function usePhotoTags(organizationId: string, query: TagsQuery = {}) {
  return useQuery({
    ...photoTagsQuery(useApi(), organizationId, query),
    placeholderData: keepPreviousData,
  });
}

// ─── Cache upkeep ────────────────────────────────────────────────────────────

const filtered = (query: PhotosQuery) =>
  query.room_id != null || query.unassigned === true || (query.tag?.length ?? 0) > 0;

/** Put a photo the API returned in its detail and the lists, then refresh around it. */
async function settle(
  queryClient: QueryClient,
  organizationId: string,
  claimId: string,
  photo: Photo,
  place: (photos: Photo[], index: number) => Photo[],
): Promise<void> {
  queryClient.setQueryData<Photo>(queryKeys.photo(organizationId, claimId, photo.id), photo);
  await Promise.all([
    editOrRefetch(queryClient, queryKeys.photoLists(organizationId, claimId), filtered, place),
    queryClient.invalidateQueries({ queryKey: queryKeys.timelines(organizationId, claimId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.photoTagLists(organizationId) }),
  ]);
}

// ─── Changing ────────────────────────────────────────────────────────────────

export type PhotoUpload = FileFacts<Schema<"PhotoType">> &
  Omit<RequestBody<typeof UPLOADS, "post">, "filename" | "content_type" | "size_bytes">;

/**
 * Upload a photo: `mutate({ file, room_id?, caption?, tags? })`. A file of a type the API
 * doesn't take, or an empty one, fails with `UploadError("invalid")` before any request.
 */
export function useUploadPhoto(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const path = { organization_id: organizationId, claim_id: claimId };
  return useMutation({
    mutationFn: (photo: PhotoUpload) =>
      uploadFile(api, photo, {
        schema: schemas.PhotoUploadCreate,
        start: (body: RequestBody<typeof UPLOADS, "post">, signal) =>
          api.post(UPLOADS, { path, body, signal }),
        finish: (uploadId, signal) =>
          api.post(`${UPLOADS}/{upload_id}/complete`, {
            path: { ...path, upload_id: uploadId },
            signal,
          }),
      }),
    onSuccess: (created) =>
      settle(queryClient, organizationId, claimId, created, (photos, index) =>
        index === 0 ? [created, ...photos.filter((photo) => photo.id !== created.id)] : photos,
      ),
  });
}

export interface PhotoChange {
  photoId: string;
  changes: RequestBody<typeof PHOTO, "patch">;
}

/** Caption, tag or move a photo to another room (`room_id: null` unassigns it). */
export function useUpdatePhoto(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ photoId, changes }: PhotoChange) =>
      api.patch(PHOTO, {
        path: { organization_id: organizationId, claim_id: claimId, photo_id: photoId },
        body: changes,
      }),
    onSuccess: (updated) =>
      settle(queryClient, organizationId, claimId, updated, (photos) =>
        photos.map((photo) => (photo.id === updated.id ? updated : photo)),
      ),
  });
}

export function useDeletePhoto(organizationId: string, claimId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) =>
      api.delete(PHOTO, {
        path: { organization_id: organizationId, claim_id: claimId, photo_id: photoId },
      }),
    onSuccess: async (_, photoId) => {
      queryClient.removeQueries({ queryKey: queryKeys.photo(organizationId, claimId, photoId) });
      await Promise.all([
        editOrRefetch(
          queryClient,
          queryKeys.photoLists(organizationId, claimId),
          () => false, // a deleted photo leaves every list
          (photos: Photo[]) => photos.filter((photo) => photo.id !== photoId),
        ),
        queryClient.invalidateQueries({ queryKey: queryKeys.timelines(organizationId, claimId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.photoTagLists(organizationId) }),
      ]);
    },
  });
}
