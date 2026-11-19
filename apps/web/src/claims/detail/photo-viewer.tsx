import { isApiError, type Schema } from "@claimforge/api-client";
import {
  useDeletePhoto,
  usePhoto,
  useStructures,
  useUpdatePhoto,
} from "@claimforge/api-client/react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  FormField,
  Inline,
  Input,
  Select,
  SkeletonText,
  Stack,
  Text,
  Textarea,
} from "@claimforge/ui";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Facts } from "../../app/facts";
import { useOrganization } from "../../app/organization";
import { errorCopy } from "../../app/states";
import { fullTime } from "../../format/relative-time";
import { parseTags, tagsProblem, tagsText } from "../photo-tags";
import { useClaimOfPage } from "./tabs";

type Photo = Schema<"PhotoRead">;

const NO_ROOM = "none";

export interface PhotoViewerProps {
  /** The photos as listed (and filtered): what previous and next step through. */
  photos: Photo[];
  /** The photo open, or `null` for none. */
  photoId: string | null;
  /** Show another photo (`replace`: stepping, not opening), or close (`null`). */
  onShow: (photoId: string | null, how?: { replace: boolean }) => void;
  canWork: boolean;
}

/** A photo full size, its details, stepping through the list, and changing it. */
export function PhotoViewer({ photos, photoId, onShow, canWork }: PhotoViewerProps) {
  return (
    <Dialog
      open={photoId !== null}
      onOpenChange={(open) => {
        if (!open) onShow(null);
      }}
    >
      {photoId !== null && (
        <Viewer photos={photos} photoId={photoId} onShow={onShow} canWork={canWork} />
      )}
    </Dialog>
  );
}

function Viewer({ photos, photoId, onShow, canWork }: PhotoViewerProps & { photoId: string }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  // A linked photo may not be in the list loaded so far (or the filter): ask for it.
  const listed = photos.find((p) => p.id === photoId);
  const fetched = usePhoto(organization.id, claim.id, photoId);
  const photo = listed ?? fetched.data;
  const index = photos.findIndex((p) => p.id === photoId);
  const previous = index > 0 ? photos[index - 1] : undefined;
  const next = index >= 0 ? photos[index + 1] : undefined;
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = useDeletePhoto(organization.id, claim.id);

  const step = (to: Photo | undefined) => {
    if (to) {
      setEditing(false);
      onShow(to.id, { replace: true });
    }
  };

  // Arrow keys step while the viewer is open, unless they're moving a cursor in a field.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [role='combobox'], [contenteditable='true']")) {
        return;
      }
      if (event.key === "ArrowLeft") step(previous);
      if (event.key === "ArrowRight") step(next);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  });

  const title = photo ? (photo.caption ?? photo.filename) : "Photo";
  const position = index >= 0 ? `${String(index + 1)} of ${String(photos.length)}` : null;

  return (
    <DialogContent title={title} description={position ?? undefined} size="full">
      <div style={{ height: "100%" }}>
        {!photo ? (
          fetched.isError ? (
            <Text as="p" role="alert" tone="danger">
              {isApiError(fetched.error) && fetched.error.status === 404
                ? "This photo isn't on the claim any more."
                : message(fetched.error)}
            </Text>
          ) : (
            <SkeletonText lines={4} />
          )
        ) : (
          // The picture takes most of the width; the details wrap below it on a phone.
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--cf-space-6)",
              alignItems: "flex-start",
            }}
          >
            <Stack gap={3} style={{ flex: "3 1 28rem", minWidth: 0 }}>
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  background: "var(--cf-color-border)",
                  borderRadius: "var(--cf-radius-md)",
                  minHeight: "16rem",
                }}
              >
                {photo.processing === "pending" ? (
                  <Text tone="muted">Processing…</Text>
                ) : (
                  <img
                    src={photo.preview_url ?? photo.url}
                    alt={title}
                    style={{ maxWidth: "100%", maxHeight: "65vh", objectFit: "contain" }}
                  />
                )}
              </div>
              <Inline justify="between" align="center">
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon={<ChevronLeft size={16} />}
                  disabled={!previous}
                  onClick={() => {
                    step(previous);
                  }}
                >
                  Previous
                </Button>
                <Button variant="ghost" size="sm" leadingIcon={<Download size={16} />} asChild>
                  <a href={photo.download_url} download={photo.filename}>
                    Download original
                  </a>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  trailingIcon={<ChevronRight size={16} />}
                  disabled={!next}
                  onClick={() => {
                    step(next);
                  }}
                >
                  Next
                </Button>
              </Inline>
            </Stack>
            <div style={{ flex: "1 1 18rem", minWidth: 0 }}>
              {editing ? (
                <PhotoEditForm
                  photo={photo}
                  onDone={() => {
                    setEditing(false);
                  }}
                />
              ) : (
                <Stack gap={4}>
                  <Facts
                    label="About this photo"
                    facts={[
                      ["Caption", photo.caption],
                      ["Room", photo.room?.name ?? "No room"],
                      ["Tags", photo.tags.join(", ")],
                      ["Taken", photo.taken_at && fullTime(photo.taken_at)],
                      [
                        "Added",
                        `${fullTime(photo.created_at)}${photo.uploaded_by ? ` by ${photo.uploaded_by.full_name}` : ""}`,
                      ],
                      ["File", photo.filename],
                    ]}
                  />
                  {canWork && (
                    <Inline gap={3}>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setEditing(true);
                        }}
                      >
                        Edit details
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          setDeleting(true);
                        }}
                      >
                        Delete
                      </Button>
                    </Inline>
                  )}
                </Stack>
              )}
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        tone="danger"
        title="Delete this photo?"
        description="It comes off the claim, and the file is deleted."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={async () => {
          try {
            await remove.mutateAsync(photoId);
          } catch (error) {
            throw new Error(message(error), { cause: error });
          }
          // On to the next photo (or the one before), or back to the grid.
          const after = next ?? previous;
          onShow(after ? after.id : null, { replace: true });
        }}
      />
    </DialogContent>
  );
}

function PhotoEditForm({ photo, onDone }: { photo: Photo; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const layout = useStructures(organization.id, claim.id);
  const update = useUpdatePhoto(organization.id, claim.id);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [tags, setTags] = useState(() => tagsText(photo.tags));
  const [room, setRoom] = useState(photo.room?.id ?? NO_ROOM);
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const rooms = (layout.data ?? []).flatMap((s) =>
    s.rooms.map((r) => ({
      value: r.id,
      label: layout.data && layout.data.length > 1 ? `${r.name} (${s.name})` : r.name,
    })),
  );

  const save = async () => {
    const found = tagsProblem(tags);
    setProblem(found);
    setFailure(null);
    if (found) return;
    try {
      await update.mutateAsync({
        photoId: photo.id,
        changes: {
          // Blank clears the caption, as the API has it.
          caption,
          tags: parseTags(tags),
          room_id: room === NO_ROOM ? null : room,
        },
      });
    } catch (error) {
      setFailure(
        isApiError(error, "unknown_room")
          ? "That room isn't on the claim any more."
          : message(error),
      );
      return;
    }
    onDone();
  };

  return (
    <form
      noValidate
      aria-label="Photo details"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Stack gap={4}>
        {failure && (
          <Text as="p" role="alert" tone="danger">
            {failure}
          </Text>
        )}
        <FormField label="Caption">
          <Textarea
            rows={3}
            maxLength={2000}
            value={caption}
            onChange={(event) => {
              setCaption(event.target.value);
            }}
          />
        </FormField>
        <FormField
          label="Tags"
          hint="Separate with commas: before, ceiling"
          error={problem ?? undefined}
        >
          <Input
            value={tags}
            onChange={(event) => {
              setTags(event.target.value);
            }}
          />
        </FormField>
        <FormField label="Room">
          <Select
            options={[...rooms, { value: NO_ROOM, label: "No room" }]}
            value={room}
            onValueChange={setRoom}
          />
        </FormField>
        <Inline gap={3}>
          <Button type="submit" variant="primary" loading={update.isPending}>
            Save changes
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        </Inline>
      </Stack>
    </form>
  );
}

function message(error: unknown): string {
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled, so its photos can't change.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
