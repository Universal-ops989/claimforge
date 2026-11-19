import type { Schema } from "@claimforge/api-client";
import { allItems, usePhotos, usePhotoTags, useStructures } from "@claimforge/api-client/react";
import {
  Button,
  EmptyState,
  FormField,
  Grid,
  Inline,
  Select,
  SkeletonText,
  Stack,
  Text,
} from "@claimforge/ui";
import { useSearchParams } from "react-router";

import { useOrganization } from "../../app/organization";
import { QueryView } from "../../app/states";
import {
  hasPhotoFilters,
  NO_PHOTO_FILTERS,
  photoFiltersQuery,
  readPhotoFilters,
  toggleTag,
  writePhotoFilters,
  type PhotoFilters,
} from "../photo-filters";
import { READ_ONLY_STATUSES } from "../status";
import { PhotoUploader } from "./photo-uploader";
import { PhotoViewer } from "./photo-viewer";
import { useClaimOfPage } from "./tabs";

type Photo = Schema<"PhotoRead">;

/** Every room, and photos in none: the room filter's choices. */
const ALL_ROOMS = "all";

/** The claim's photos as a grid, filtered by room and tags kept in the address. */
export function PhotosTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const [params, setParams] = useSearchParams();
  const filters = readPhotoFilters(params);
  const photos = usePhotos(organization.id, claim.id, photoFiltersQuery(filters));
  const filter = (next: PhotoFilters) => {
    setParams(writePhotoFilters(params, next), { replace: true });
  };
  // The open photo is in the address: it can be linked, and Back closes it.
  const openId = params.get("photo");
  const show = (photoId: string | null, how = { replace: false }) => {
    const nextParams = new URLSearchParams(params);
    if (photoId) nextParams.set("photo", photoId);
    else nextParams.delete("photo");
    setParams(nextParams, how);
  };
  const canWork =
    organization.permissions.includes("field_data:write") &&
    !READ_ONLY_STATUSES.includes(claim.status);

  return (
    <Stack gap={4}>
      {canWork && <PhotoUploader roomId={filters.room} />}
      <PhotoFilterBar filters={filters} onChange={filter} />
      <QueryView query={photos} loading={<SkeletonText lines={4} />}>
        {(data) => {
          const shown = allItems(data);
          if (shown.length === 0) {
            return hasPhotoFilters(filters) ? (
              <EmptyState
                size="compact"
                headingLevel={2}
                title="No photos match"
                description="No photo is in that room with every tag chosen."
                actions={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      filter(NO_PHOTO_FILTERS);
                    }}
                  >
                    Show all photos
                  </Button>
                }
              />
            ) : (
              <EmptyState
                headingLevel={2}
                title="No photos yet"
                description="Photos taken on site show here, newest first."
              />
            );
          }
          return (
            <Stack gap={4}>
              <Grid
                as="ul"
                minChildWidth="12rem"
                gap={4}
                aria-label="Photos"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {shown.map((photo) => (
                  <li key={photo.id}>
                    <PhotoTile
                      photo={photo}
                      onOpen={() => {
                        show(photo.id);
                      }}
                    />
                  </li>
                ))}
              </Grid>
              <Stack gap={2} align="center">
                <Text size="sm" tone="muted" role="status">
                  {photos.hasNextPage
                    ? `Showing ${String(shown.length)} photos`
                    : `Showing all ${String(shown.length)} ${shown.length === 1 ? "photo" : "photos"}`}
                </Text>
                {photos.hasNextPage && (
                  <Button
                    variant="secondary"
                    loading={photos.isFetchingNextPage}
                    onClick={() => {
                      void photos.fetchNextPage();
                    }}
                  >
                    Load more photos
                  </Button>
                )}
              </Stack>
            </Stack>
          );
        }}
      </QueryView>
      <PhotoViewer
        photos={allItems(photos.data)}
        photoId={openId}
        onShow={show}
        canWork={canWork}
      />
    </Stack>
  );
}

/** The room and tag filters: rooms from the layout, tags from those in use. */
function PhotoFilterBar({
  filters,
  onChange,
}: {
  filters: PhotoFilters;
  onChange: (filters: PhotoFilters) => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const layout = useStructures(organization.id, claim.id);
  const tags = usePhotoTags(organization.id, { limit: 20 });
  const rooms = (layout.data ?? []).flatMap((s) =>
    s.rooms.map((r) => ({
      value: r.id,
      label: layout.data && layout.data.length > 1 ? `${r.name} (${s.name})` : r.name,
    })),
  );
  // Tags chosen stay on offer even when they're not among the most used.
  const offered = [...new Set([...filters.tags, ...(tags.data ?? []).map((t) => t.tag)])].sort();

  return (
    <Stack gap={3}>
      <Inline gap={4} align="end">
        <FormField label="Room">
          <Select
            options={[
              { value: ALL_ROOMS, label: "All rooms" },
              ...rooms,
              { value: "none", label: "No room" },
            ]}
            value={filters.room ?? ALL_ROOMS}
            onValueChange={(value) => {
              onChange({ ...filters, room: value === ALL_ROOMS ? null : value });
            }}
          />
        </FormField>
        {hasPhotoFilters(filters) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(NO_PHOTO_FILTERS);
            }}
          >
            Clear filters
          </Button>
        )}
      </Inline>
      {offered.length > 0 && (
        <Inline gap={2} align="center" role="group" aria-labelledby="photo-tags-label">
          <Text size="sm" tone="muted" id="photo-tags-label">
            Tags
          </Text>
          {offered.map((tag) => {
            const on = filters.tags.includes(tag);
            return (
              <Button
                key={tag}
                size="sm"
                variant={on ? "primary" : "secondary"}
                aria-pressed={on}
                onClick={() => {
                  onChange(toggleTag(filters, tag));
                }}
              >
                {tag}
              </Button>
            );
          })}
        </Inline>
      )}
    </Stack>
  );
}

/** A photo's thumbnail (which opens it full size), caption, room and tags. */
function PhotoTile({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  const label = photo.caption ?? photo.filename;
  return (
    <figure style={{ margin: 0 }}>
      <button
        type="button"
        aria-label={`Open ${label}`}
        onClick={onOpen}
        style={{
          width: "100%",
          padding: 0,
          border: 0,
          cursor: "zoom-in",
          aspectRatio: "4 / 3",
          borderRadius: "var(--cf-radius-md)",
          overflow: "hidden",
          background: "var(--cf-color-border)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {photo.processing === "pending" || !photo.thumbnail_url ? (
          <Text size="sm" tone="muted">
            {photo.processing === "failed" ? "Couldn't make a preview" : "Processing…"}
          </Text>
        ) : (
          <img
            src={photo.thumbnail_url}
            alt={label}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </button>
      <figcaption>
        <Stack gap={1} style={{ paddingBlockStart: "var(--cf-space-2)" }}>
          <Text size="sm">{label}</Text>
          <Text size="sm" tone="muted">
            {[photo.room?.name ?? "No room", ...photo.tags].join(" · ")}
          </Text>
        </Stack>
      </figcaption>
    </figure>
  );
}
