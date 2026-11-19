import { useStructures, useUploadPhoto } from "@claimforge/api-client/react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  FileDropzone,
  FormField,
  Inline,
  Select,
  Stack,
  Text,
  type BadgeTone,
} from "@claimforge/ui";
import { useRef, useState } from "react";

import { useOrganization } from "../../app/organization";
import {
  eachAtMost,
  PHOTO_ACCEPT,
  PHOTO_MAX_BYTES,
  photoType,
  uploadFailure,
} from "../photo-upload";
import { useClaimOfPage } from "./tabs";

/** How many photos go up at once: enough to keep a site connection busy, not swamp it. */
const AT_ONCE = 3;
const NO_ROOM = "none";

type State = "waiting" | "uploading" | "done" | "failed";

interface Queued {
  key: number;
  file: File;
  roomId: string | null;
  state: State;
  error: string | null;
}

const STATE_LABEL: Record<State, string> = {
  waiting: "Waiting",
  uploading: "Uploading…",
  done: "Added",
  failed: "Not added",
};

const STATE_TONE: Record<State, BadgeTone> = {
  waiting: "neutral",
  uploading: "info",
  done: "success",
  failed: "danger",
};

/**
 * Upload photos to the claim: drop or browse, choose the room, and watch each one go.
 * A failed photo says why and can be tried again; the others carry on.
 */
export function PhotoUploader({ roomId }: { roomId: string | null }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const layout = useStructures(organization.id, claim.id);
  const upload = useUploadPhoto(organization.id, claim.id);
  const [room, setRoom] = useState<string>(roomId && roomId !== NO_ROOM ? roomId : NO_ROOM);
  const [queue, setQueue] = useState<Queued[]>([]);
  const [refused, setRefused] = useState<string[]>([]);
  const nextKeyRef = useRef(0);

  const update = (key: number, changes: Partial<Queued>) => {
    setQueue((items) => items.map((item) => (item.key === key ? { ...item, ...changes } : item)));
  };

  const send = (items: Queued[]) =>
    eachAtMost(items, AT_ONCE, async (item) => {
      update(item.key, { state: "uploading", error: null });
      try {
        const type = photoType(item.file);
        await upload.mutateAsync({
          file: item.file,
          ...(type ? { content_type: type } : {}),
          ...(item.roomId ? { room_id: item.roomId } : {}),
        });
        update(item.key, { state: "done" });
      } catch (error) {
        update(item.key, { state: "failed", error: uploadFailure(error) });
      }
    });

  const add = (files: File[]) => {
    const items = files.map((file): Queued => ({
      key: (nextKeyRef.current += 1),
      file,
      roomId: room === NO_ROOM ? null : room,
      state: "waiting",
      error: null,
    }));
    setQueue((before) => [...before, ...items]);
    void send(items);
  };

  const rooms = (layout.data ?? []).flatMap((s) =>
    s.rooms.map((r) => ({
      value: r.id,
      label: layout.data && layout.data.length > 1 ? `${r.name} (${s.name})` : r.name,
    })),
  );
  const finished = queue.filter((item) => item.state === "done").length;

  return (
    <Card role="region" aria-label="Add photos">
      <CardHeader headingLevel={2} title="Add photos" />
      <CardBody>
        <Stack gap={3}>
          <div style={{ maxWidth: "20rem" }}>
            <FormField label="Put new photos in">
              <Select
                options={[...rooms, { value: NO_ROOM, label: "No room" }]}
                value={room}
                onValueChange={setRoom}
              />
            </FormField>
          </div>
          <FileDropzone
            title="Drop photos here"
            hint="JPEG, PNG, WebP or HEIC, up to 25 MB each"
            browseLabel="Choose photos"
            accept={PHOTO_ACCEPT}
            maxSize={PHOTO_MAX_BYTES}
            multiple
            capture="environment"
            // It lists files it refuses itself (type, size); a file it takes by name that
            // still isn't a photo the API takes is caught here.
            onFilesAccepted={(files) => {
              const photos = files.filter((file) => photoType(file) !== null);
              setRefused(
                files
                  .filter((file) => photoType(file) === null)
                  .map((file) => `${file.name}: not a photo the claim can take.`),
              );
              if (photos.length > 0) add(photos);
            }}
          />
          {refused.length > 0 && (
            <Stack
              as="ul"
              gap={1}
              role="alert"
              style={{ margin: 0, paddingInlineStart: "1.25rem" }}
            >
              {refused.map((line) => (
                <li key={line}>
                  <Text size="sm" tone="danger">
                    {line}
                  </Text>
                </li>
              ))}
            </Stack>
          )}
          {queue.length > 0 && (
            <Stack gap={2}>
              <Stack
                as="ul"
                gap={2}
                aria-label="Uploads"
                style={{ listStyle: "none", margin: 0, padding: 0 }}
              >
                {queue.map((item) => (
                  <li key={item.key}>
                    <Inline justify="between" align="center" gap={3}>
                      <Stack gap={1}>
                        <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                          {item.file.name}
                        </Text>
                        {item.error && (
                          <Text size="sm" tone="danger">
                            {item.error}
                          </Text>
                        )}
                      </Stack>
                      <Inline gap={2} align="center">
                        <Badge tone={STATE_TONE[item.state]} size="sm">
                          {STATE_LABEL[item.state]}
                        </Badge>
                        {item.state === "failed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Try ${item.file.name} again`}
                            onClick={() => {
                              void send([item]);
                            }}
                          >
                            Try again
                          </Button>
                        )}
                      </Inline>
                    </Inline>
                  </li>
                ))}
              </Stack>
              <Inline justify="between" align="center">
                <Text size="sm" tone="muted" role="status">
                  {`${String(finished)} of ${String(queue.length)} added`}
                </Text>
                {queue.every((item) => item.state === "done" || item.state === "failed") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQueue((items) => items.filter((item) => item.state === "failed"));
                    }}
                  >
                    Clear finished
                  </Button>
                )}
              </Inline>
            </Stack>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}
