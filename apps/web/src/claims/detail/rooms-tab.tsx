import { isApiError } from "@claimforge/api-client";
import {
  useCreateRoom,
  useCreateStructure,
  useDeleteRoom,
  useDeleteStructure,
  useStructures,
  useUpdateRoom,
  useUpdateStructure,
} from "@claimforge/api-client/react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
  EmptyState,
  FormField,
  Grid,
  Inline,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  Stack,
  Text,
} from "@claimforge/ui";
import { MoreHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useOrganization } from "../../app/organization";
import { errorCopy, QueryView } from "../../app/states";
import {
  emptyRoomDraft,
  roomDraftOf,
  roomMeasures,
  roomProblems,
  roomSize,
  roomTitle,
  toRoomBody,
  type Room,
  type RoomDraft,
  type RoomField,
  type Structure,
} from "../layout";
import { READ_ONLY_STATUSES } from "../status";
import { useClaimOfPage } from "./tabs";

/** What's open: a form or a confirmation, and what it's about. */
type Open =
  | { kind: "structure"; structure: Structure | null }
  | { kind: "room"; room: Room | null; structureId: string }
  | { kind: "delete-structure"; structure: Structure }
  | { kind: "delete-room"; room: Room }
  | null;

/** The claim's layout: its structures and the rooms in each, and changing them. */
export function RoomsTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const layout = useStructures(organization.id, claim.id);
  const canWork =
    organization.permissions.includes("field_data:write") &&
    !READ_ONLY_STATUSES.includes(claim.status);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  return (
    <QueryView query={layout}>
      {(structures) => (
        <Stack gap={4}>
          {canWork && structures.length > 0 && (
            <Inline justify="end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOpen({ kind: "structure", structure: null });
                }}
              >
                Add structure
              </Button>
            </Inline>
          )}
          {structures.length === 0 ? (
            <EmptyState
              headingLevel={2}
              title="No rooms yet"
              description="Add the building first (the house, say), then its rooms."
              actions={
                canWork && (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setOpen({ kind: "structure", structure: null });
                    }}
                  >
                    Add structure
                  </Button>
                )
              }
            />
          ) : (
            structures.map((structure) => (
              <StructureCard
                key={structure.id}
                structure={structure}
                canWork={canWork}
                onOpen={setOpen}
              />
            ))
          )}
          <Dialog
            open={open?.kind === "structure" || open?.kind === "room"}
            onOpenChange={(next) => {
              if (!next) close();
            }}
          >
            {open?.kind === "structure" && (
              <StructureForm structure={open.structure} onDone={close} />
            )}
            {open?.kind === "room" && (
              <RoomForm
                room={open.room}
                structureId={open.structureId}
                structures={structures}
                onDone={close}
              />
            )}
          </Dialog>
          <DeleteConfirm open={open} onClose={close} />
        </Stack>
      )}
    </QueryView>
  );
}

function StructureCard({
  structure,
  canWork,
  onOpen,
}: {
  structure: Structure;
  canWork: boolean;
  onOpen: (open: Open) => void;
}) {
  return (
    <Card role="region" aria-label={structure.name}>
      <CardHeader
        headingLevel={2}
        title={structure.name}
        description={`${String(structure.rooms.length)} ${structure.rooms.length === 1 ? "room" : "rooms"}`}
        actions={
          canWork && (
            <Inline gap={2}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onOpen({ kind: "room", room: null, structureId: structure.id });
                }}
              >
                Add room
              </Button>
              <RowMenu
                label={`Change ${structure.name}`}
                items={[
                  [
                    "Rename",
                    () => {
                      onOpen({ kind: "structure", structure });
                    },
                  ],
                  [
                    "Delete",
                    () => {
                      onOpen({ kind: "delete-structure", structure });
                    },
                  ],
                ]}
              />
            </Inline>
          )
        }
      />
      <CardBody>
        {structure.rooms.length === 0 ? (
          <Text as="p" tone="muted">
            No rooms in {structure.name} yet.
          </Text>
        ) : (
          <Stack
            as="ul"
            gap={3}
            aria-label={`Rooms in ${structure.name}`}
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {structure.rooms.map((room) => (
              <li key={room.id}>
                <Inline justify="between" align="start" gap={3}>
                  <Stack gap={1}>
                    <Text>{roomTitle(room)}</Text>
                    <Text size="sm" tone="muted">
                      {roomSize(room)}
                    </Text>
                    {roomMeasures(room) && (
                      <Text size="sm" tone="subtle">
                        {roomMeasures(room)}
                      </Text>
                    )}
                  </Stack>
                  {canWork && (
                    <RowMenu
                      label={`Change the ${room.name}`}
                      items={[
                        [
                          "Edit",
                          () => {
                            onOpen({ kind: "room", room, structureId: structure.id });
                          },
                        ],
                        [
                          "Delete",
                          () => {
                            onOpen({ kind: "delete-room", room });
                          },
                        ],
                      ]}
                    />
                  )}
                </Inline>
              </li>
            ))}
          </Stack>
        )}
      </CardBody>
    </Card>
  );
}

/** A "…" menu of actions, the last one (delete) in danger tone. */
function RowMenu({ label, items }: { label: string; items: [string, () => void][] }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={label}>
          <MoreHorizontal size={16} aria-hidden="true" />
        </Button>
      </MenuTrigger>
      <MenuContent>
        {items.map(([name, run], index) => (
          <MenuItem
            key={name}
            tone={index === items.length - 1 ? "danger" : "default"}
            onSelect={run}
          >
            {name}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

function StructureForm({ structure, onDone }: { structure: Structure | null; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const create = useCreateStructure(organization.id, claim.id);
  const rename = useUpdateStructure(organization.id, claim.id);
  const [name, setName] = useState(structure?.name ?? "");
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setProblem("Enter a name: the house, the garage…");
      return;
    }
    if (trimmed.length > 100) {
      setProblem("Keep this to 100 characters or fewer.");
      return;
    }
    setProblem(null);
    setFailure(null);
    try {
      if (structure) {
        await rename.mutateAsync({ structureId: structure.id, changes: { name: trimmed } });
      } else {
        await create.mutateAsync({ name: trimmed });
      }
    } catch (error) {
      if (isApiError(error, "name_taken")) {
        setProblem("This claim already has a structure with that name.");
      } else {
        setFailure(message(error));
      }
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title={structure ? `Rename ${structure.name}` : "Add a structure"}
      submitLabel={structure ? "Rename" : "Add structure"}
      pending={create.isPending || rename.isPending}
      failure={failure}
      onSubmit={save}
    >
      <FormField
        label="Name"
        required
        hint="The house, the garage, Unit 2B…"
        error={problem ?? undefined}
      >
        <Input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
      </FormField>
    </FormDialog>
  );
}

function RoomForm({
  room,
  structureId,
  structures,
  onDone,
}: {
  room: Room | null;
  structureId: string;
  structures: Structure[];
  onDone: () => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const create = useCreateRoom(organization.id, claim.id);
  const update = useUpdateRoom(organization.id, claim.id);
  const [draft, setDraft] = useState<RoomDraft>(() =>
    room ? roomDraftOf(room) : emptyRoomDraft(structureId),
  );
  const [problems, setProblems] = useState<Partial<Record<RoomField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const set = (field: RoomField) => (value: string) => {
    setDraft((before) => ({ ...before, [field]: value }));
  };

  const save = async () => {
    const found = roomProblems(draft);
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    const body = toRoomBody(draft);
    try {
      if (room) {
        await update.mutateAsync({
          roomId: room.id,
          changes:
            draft.structure_id === room.structure_id
              ? body
              : { ...body, structure_id: draft.structure_id },
        });
      } else {
        await create.mutateAsync({ structureId: draft.structure_id, room: body });
      }
    } catch (error) {
      if (isApiError(error, "name_taken")) {
        setProblems({ name: "That structure already has a room with this name." });
      } else if (isApiError(error, "validation_failed")) {
        const fields: Partial<Record<RoomField, string>> = {};
        for (const { loc, message: text } of error.fieldErrors) {
          const field = loc[1];
          if (typeof field === "string" && field in draft) fields[field as RoomField] = text;
        }
        setProblems(fields);
        if (Object.keys(fields).length === 0) setFailure(message(error));
      } else {
        setFailure(message(error));
      }
      return;
    }
    onDone();
  };

  const feet = (field: "length_ft" | "width_ft" | "height_ft", label: string) => (
    <FormField label={label} hint="Feet" error={problems[field]}>
      <Input
        inputMode="decimal"
        value={draft[field]}
        suffix="ft"
        onChange={(event) => {
          set(field)(event.target.value);
        }}
      />
    </FormField>
  );

  return (
    <FormDialog
      title={room ? `Edit the ${room.name}` : "Add a room"}
      submitLabel={room ? "Save changes" : "Add room"}
      pending={create.isPending || update.isPending}
      failure={failure}
      onSubmit={save}
    >
      <Grid minChildWidth="12rem" gap={4}>
        <FormField label="Name" required error={problems.name}>
          <Input
            value={draft.name}
            onChange={(event) => {
              set("name")(event.target.value);
            }}
          />
        </FormField>
        <FormField label="Level" hint="Basement, Main floor, 2…" error={problems.level}>
          <Input
            value={draft.level}
            onChange={(event) => {
              set("level")(event.target.value);
            }}
          />
        </FormField>
      </Grid>
      <Grid minChildWidth="8rem" gap={4}>
        {feet("length_ft", "Length")}
        {feet("width_ft", "Width")}
        {feet("height_ft", "Height")}
      </Grid>
      {room && structures.length > 1 && (
        <FormField label="In">
          <Select
            options={structures.map((s) => ({ value: s.id, label: s.name }))}
            value={draft.structure_id}
            onValueChange={set("structure_id")}
          />
        </FormField>
      )}
    </FormDialog>
  );
}

/** A dialog around a form: the fields, a failure above them, Cancel and submit below. */
function FormDialog({
  title,
  submitLabel,
  pending,
  failure,
  onSubmit,
  children,
}: {
  title: string;
  submitLabel: string;
  pending: boolean;
  failure: string | null;
  onSubmit: () => Promise<void>;
  children: ReactNode;
}) {
  const formId = useId();
  return (
    <DialogContent
      title={title}
      size="md"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button type="submit" form={formId} variant="primary" loading={pending}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        aria-label={title}
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <Stack gap={4}>
          {failure && (
            <Text as="p" role="alert" tone="danger">
              {failure}
            </Text>
          )}
          {children}
        </Stack>
      </form>
    </DialogContent>
  );
}

/** Asks before deleting, saying what goes with it; the API's refusal shows in it. */
function DeleteConfirm({ open, onClose }: { open: Open; onClose: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const deleteStructure = useDeleteStructure(organization.id, claim.id);
  const deleteRoom = useDeleteRoom(organization.id, claim.id);
  const structure = open?.kind === "delete-structure" ? open.structure : null;
  const room = open?.kind === "delete-room" ? open.room : null;
  const rooms = structure?.rooms.length ?? 0;

  return (
    <ConfirmDialog
      open={structure !== null || room !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      tone="danger"
      confirmLabel="Delete"
      cancelLabel="Keep it"
      title={structure ? `Delete ${structure.name}?` : room ? `Delete the ${room.name}?` : ""}
      description={
        structure
          ? rooms > 0
            ? `Its ${String(rooms)} ${rooms === 1 ? "room goes" : "rooms go"} with it, and the damage recorded in them.`
            : "It has no rooms."
          : "The damage recorded in it goes with it. Its photos stay on the claim."
      }
      onConfirm={async () => {
        try {
          if (structure) await deleteStructure.mutateAsync(structure.id);
          else if (room) await deleteRoom.mutateAsync(room.id);
        } catch (error) {
          throw new Error(deleteFailure(error), { cause: error });
        }
      }}
    />
  );
}

/** A delete the API refused, in words. */
function deleteFailure(error: unknown): string {
  if (isApiError(error, "has_moisture_points")) {
    return "It has moisture points: drying records stay with their room. It can't be deleted.";
  }
  if (isApiError(error, "has_atmospheric_readings")) {
    return "It has atmospheric readings: drying records stay with their room. It can't be deleted.";
  }
  if (isApiError(error, "has_equipment_placements")) {
    return "Equipment has been placed in it: its history stays with the room. It can't be deleted.";
  }
  return message(error);
}

function message(error: unknown): string {
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled, so its layout can't change.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
