import { isApiError } from "@claimforge/api-client";
import {
  allItems,
  useDeletePlacement,
  useEquipment,
  useEquipmentDays,
  usePlaceEquipment,
  usePlacements,
  useRemoveEquipment,
  useStructures,
  useUpdatePlacement,
} from "@claimforge/api-client/react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Dialog,
  EmptyState,
  FormField,
  Inline,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Select,
  SkeletonText,
  Stack,
  Text,
} from "@claimforge/ui";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { FormDialog } from "../../app/form-dialog";
import { useOrganization } from "../../app/organization";
import { errorCopy, QueryView } from "../../app/states";
import { fullTime } from "../../format/relative-time";
import {
  capacity,
  days,
  fromLocalInput,
  KIND_LABEL,
  toLocalInput,
  type Placement,
} from "../equipment";
import { READ_ONLY_STATUSES } from "../status";
import { useClaimOfPage } from "./tabs";

type Open =
  | { kind: "place" }
  | { kind: "remove"; placement: Placement }
  | { kind: "correct"; placement: Placement }
  | { kind: "delete"; placement: Placement }
  | null;

/** What's drying the job, where, for how long, and what it bills. */
export function EquipmentTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const placements = usePlacements(organization.id, claim.id);
  const fieldWork = organization.permissions.includes("field_data:write");
  const open = !READ_ONLY_STATUSES.includes(claim.status);
  // Removing works on a closed claim too, so a unit is never stranded on a finished job.
  const canPlace = fieldWork && open;
  const [dialog, setDialog] = useState<Open>(null);
  const close = () => {
    setDialog(null);
  };

  return (
    <Stack gap={4}>
      <BillableDays />
      {canPlace && (
        <Inline justify="end">
          <Button
            variant="primary"
            onClick={() => {
              setDialog({ kind: "place" });
            }}
          >
            Place equipment
          </Button>
        </Inline>
      )}
      <QueryView query={placements} loading={<SkeletonText lines={3} />}>
        {(all) => {
          const running = all.filter((p) => p.running);
          const removed = all.filter((p) => !p.running);
          return (
            <Stack gap={4}>
              <Card role="region" aria-label="On site now">
                <CardHeader headingLevel={2} title="On site now" />
                <CardBody>
                  {running.length === 0 ? (
                    <EmptyState
                      size="compact"
                      headingLevel={3}
                      title="Nothing running"
                      description="Place dehumidifiers and air movers as they go in; their days count until they come out."
                    />
                  ) : (
                    <PlacementList
                      label="On site now"
                      placements={running}
                      actions={(placement) =>
                        fieldWork
                          ? [
                              [
                                "Remove",
                                () => {
                                  setDialog({ kind: "remove", placement });
                                },
                              ],
                              ...(open
                                ? ([
                                    [
                                      "Move or correct",
                                      () => {
                                        setDialog({ kind: "correct", placement });
                                      },
                                    ],
                                    [
                                      "Delete",
                                      () => {
                                        setDialog({ kind: "delete", placement });
                                      },
                                    ],
                                  ] as [string, () => void][])
                                : []),
                            ]
                          : []
                      }
                    />
                  )}
                </CardBody>
              </Card>
              {removed.length > 0 && (
                <Card role="region" aria-label="Removed">
                  <CardHeader headingLevel={2} title="Removed" />
                  <CardBody>
                    <PlacementList
                      label="Removed"
                      placements={removed}
                      actions={(placement) =>
                        fieldWork && open
                          ? [
                              [
                                "Correct",
                                () => {
                                  setDialog({ kind: "correct", placement });
                                },
                              ],
                              [
                                "Delete",
                                () => {
                                  setDialog({ kind: "delete", placement });
                                },
                              ],
                            ]
                          : []
                      }
                    />
                  </CardBody>
                </Card>
              )}
            </Stack>
          );
        }}
      </QueryView>
      <Dialog
        open={dialog !== null && dialog.kind !== "delete"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {dialog?.kind === "place" && <PlaceForm onDone={close} />}
        {dialog?.kind === "remove" && <RemoveForm placement={dialog.placement} onDone={close} />}
        {dialog?.kind === "correct" && <CorrectForm placement={dialog.placement} onDone={close} />}
      </Dialog>
      <DeletePlacement
        placement={dialog?.kind === "delete" ? dialog.placement : null}
        onClose={close}
      />
    </Stack>
  );
}

/** Billable equipment-days by kind: what the estimate charges. */
function BillableDays() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const billed = useEquipmentDays(organization.id, claim.id);
  return (
    <Card role="region" aria-label="Billable days">
      <CardHeader
        headingLevel={2}
        title="Billable days"
        description="Every started 24 hours counts; units still running count up to now."
      />
      <CardBody>
        <QueryView query={billed} loading={<SkeletonText lines={2} />}>
          {(rows) =>
            rows.length === 0 ? (
              <Text tone="muted">No equipment placed yet.</Text>
            ) : (
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {["Kind", "Placements", "Running", "Days"].map((heading, i) => (
                      <th
                        key={heading}
                        scope="col"
                        style={{ textAlign: i === 0 ? "start" : "end" }}
                      >
                        <Text size="sm" tone="muted">
                          {heading}
                        </Text>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.kind}>
                      <th scope="row" style={{ textAlign: "start", fontWeight: "normal" }}>
                        <Text>{KIND_LABEL[row.kind]}</Text>
                      </th>
                      <td style={{ textAlign: "end" }}>
                        <Text>{row.placements}</Text>
                      </td>
                      <td style={{ textAlign: "end" }}>
                        <Text>{row.running}</Text>
                      </td>
                      <td style={{ textAlign: "end" }}>
                        <Text weight="semibold">{row.days}</Text>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </QueryView>
      </CardBody>
    </Card>
  );
}

function PlacementList({
  label,
  placements,
  actions,
}: {
  label: string;
  placements: Placement[];
  actions: (placement: Placement) => [string, () => void][];
}) {
  return (
    <Stack as="ul" gap={3} aria-label={label} style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {placements.map((placement) => {
        const items = actions(placement);
        const { equipment } = placement;
        return (
          <li key={placement.id}>
            <Inline justify="between" align="start" gap={3}>
              <Stack gap={1}>
                <Text>{`${equipment.asset_tag} · ${equipment.name}`}</Text>
                <Text size="sm" tone="muted">
                  {`${KIND_LABEL[equipment.kind]} · ${placement.room.name}`}
                </Text>
                <Text size="sm">
                  {placement.running
                    ? `Since ${fullTime(placement.placed_at)} · ${days(placement.days)} so far`
                    : `${fullTime(placement.placed_at)} to ${fullTime(placement.removed_at ?? "")} · ${days(placement.days)}`}
                </Text>
              </Stack>
              {items.length > 0 && (
                <Menu>
                  <MenuTrigger asChild>
                    <Button variant="ghost" size="sm" aria-label={`Change ${equipment.asset_tag}`}>
                      <MoreHorizontal size={16} aria-hidden="true" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {items.map(([name, run]) => (
                      <MenuItem
                        key={name}
                        tone={name === "Delete" ? "danger" : "default"}
                        onSelect={run}
                      >
                        {name}
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              )}
            </Inline>
          </li>
        );
      })}
    </Stack>
  );
}

/** The claim's rooms, as a select's options. */
function useRoomOptions() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const layout = useStructures(organization.id, claim.id);
  return (layout.data ?? []).flatMap((s) =>
    s.rooms.map((r) => ({
      value: r.id,
      label: layout.data && layout.data.length > 1 ? `${r.name} (${s.name})` : r.name,
    })),
  );
}

/** A `datetime-local` field for when something happened; blank means now. */
function WhenField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  // The latest it can be: now, as the field opened.
  const [latest] = useState(() => toLocalInput(new Date()));
  return (
    <FormField label={label} hint={hint} error={error}>
      <Input
        type="datetime-local"
        value={value}
        max={latest}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </FormField>
  );
}

/** A moment typed, checked: blank (`null`), a past moment, or what's wrong. */
function checkWhen(value: string): { at: string | null } | { problem: string } {
  if (!value) return { at: null };
  const at = fromLocalInput(value);
  if (!at) return { problem: "Enter a date and time." };
  if (Date.parse(at) > Date.now()) return { problem: "That's in the future." };
  return { at };
}

function PlaceForm({ onDone }: { onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const fleet = useEquipment(organization.id, { available: true, limit: 100 });
  const place = usePlaceEquipment(organization.id, claim.id);
  const rooms = useRoomOptions();
  const [unit, setUnit] = useState("");
  const [room, setRoom] = useState("");
  const [when, setWhen] = useState("");
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const free = allItems(fleet.data);

  const save = async () => {
    const found: Record<string, string> = {};
    if (!unit) found.unit = "Choose a unit.";
    if (!room) found.room = "Choose the room.";
    const at = checkWhen(when);
    if ("problem" in at) found.when = at.problem;
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0 || "problem" in at) return;
    try {
      await place.mutateAsync({
        equipment_id: unit,
        room_id: room,
        ...(at.at ? { placed_at: at.at } : {}),
      });
    } catch (error) {
      setFailure(message(error));
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title="Place equipment"
      submitLabel="Place"
      pending={place.isPending}
      failure={failure}
      onSubmit={save}
    >
      <FormField
        label="Unit"
        required
        hint={
          fleet.isSuccess && free.length === 0
            ? "Every unit in service is out on a job."
            : "Units in service and free"
        }
        error={problems.unit}
      >
        <Select
          placeholder={fleet.isPending ? "Loading the fleet…" : "Choose a unit"}
          options={free.map((u) => ({
            value: u.id,
            label: [u.asset_tag, u.name, capacity(u)].filter(Boolean).join(" · "),
          }))}
          value={unit}
          onValueChange={setUnit}
        />
      </FormField>
      <FormField label="Room" required error={problems.room}>
        <Select placeholder="Choose one" options={rooms} value={room} onValueChange={setRoom} />
      </FormField>
      <WhenField
        label="Placed"
        hint="Leave blank for now"
        value={when}
        onChange={setWhen}
        error={problems.when}
      />
    </FormDialog>
  );
}

function RemoveForm({ placement, onDone }: { placement: Placement; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const remove = useRemoveEquipment(organization.id, claim.id);
  const [when, setWhen] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const at = checkWhen(when);
    setProblem("problem" in at ? at.problem : undefined);
    setFailure(null);
    if ("problem" in at) return;
    try {
      await remove.mutateAsync({
        placementId: placement.id,
        ...(at.at ? { removed_at: at.at } : {}),
      });
    } catch (error) {
      setFailure(message(error));
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title={`Remove ${placement.equipment.asset_tag}`}
      submitLabel="Remove"
      pending={remove.isPending}
      failure={failure}
      onSubmit={save}
    >
      <Text>{`From the ${placement.room.name}, where it's been since ${fullTime(placement.placed_at)}.`}</Text>
      <WhenField
        label="Removed"
        hint="Leave blank for now"
        value={when}
        onChange={setWhen}
        error={problem}
      />
    </FormDialog>
  );
}

/** Move a unit to another room, or correct when it went in (and came out). */
function CorrectForm({ placement, onDone }: { placement: Placement; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const update = useUpdatePlacement(organization.id, claim.id);
  const rooms = useRoomOptions();
  const [room, setRoom] = useState(placement.room.id);
  const [placed, setPlaced] = useState(() => toLocalInput(placement.placed_at));
  const [removed, setRemoved] = useState(() =>
    placement.removed_at ? toLocalInput(placement.removed_at) : "",
  );
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const save = async () => {
    const found: Record<string, string> = {};
    const placedAt = checkWhen(placed);
    const removedAt = checkWhen(removed);
    if ("problem" in placedAt) found.placed = placedAt.problem;
    else if (placedAt.at === null) found.placed = "Enter when it went in.";
    if ("problem" in removedAt) found.removed = removedAt.problem;
    if (
      !("problem" in placedAt) &&
      !("problem" in removedAt) &&
      placedAt.at &&
      removedAt.at &&
      removedAt.at < placedAt.at
    ) {
      found.removed = "It can't come out before it went in.";
    }
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0 || "problem" in placedAt || "problem" in removedAt) return;
    try {
      await update.mutateAsync({
        placementId: placement.id,
        changes: {
          room_id: room,
          ...(placedAt.at ? { placed_at: placedAt.at } : {}),
          // Only a removed unit has a removal to correct; clearing it puts the unit back.
          ...(placement.removed_at ? { removed_at: removedAt.at } : {}),
        },
      });
    } catch (error) {
      setFailure(message(error));
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title={`${placement.running ? "Move or correct" : "Correct"} ${placement.equipment.asset_tag}`}
      submitLabel="Save changes"
      pending={update.isPending}
      failure={failure}
      onSubmit={save}
    >
      <FormField label="Room">
        <Select options={rooms} value={room} onValueChange={setRoom} />
      </FormField>
      <WhenField
        label="Placed"
        hint="When it went in"
        value={placed}
        onChange={setPlaced}
        error={problems.placed}
      />
      {placement.removed_at && (
        <WhenField
          label="Removed"
          hint="Clear it if the unit is still running"
          value={removed}
          onChange={setRemoved}
          error={problems.removed}
        />
      )}
    </FormDialog>
  );
}

function DeletePlacement({
  placement,
  onClose,
}: {
  placement: Placement | null;
  onClose: () => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const remove = useDeletePlacement(organization.id, claim.id);
  return (
    <ConfirmDialog
      open={placement !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      tone="danger"
      title={placement ? `Delete this placement of ${placement.equipment.asset_tag}?` : ""}
      description="Only for one entered by mistake: its days stop counting towards billing. To record the unit coming out, remove it instead."
      confirmLabel="Delete"
      cancelLabel="Keep it"
      onConfirm={async () => {
        if (!placement) return;
        try {
          await remove.mutateAsync(placement.id);
        } catch (error) {
          throw new Error(message(error), { cause: error });
        }
      }}
    />
  );
}

/** A refusal, in words. */
function message(error: unknown): string {
  if (isApiError(error, "equipment_running")) {
    return "That unit is running on another job. Remove it there first.";
  }
  if (isApiError(error, "equipment_unavailable")) {
    return "That unit isn't in service (in maintenance or retired).";
  }
  if (isApiError(error, "time_in_future")) return "That time is in the future.";
  if (isApiError(error, "removed_before_placed")) return "It can't come out before it went in.";
  if (isApiError(error, "already_removed")) return "That unit was already removed.";
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled: units can still be removed, but not placed or changed.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
