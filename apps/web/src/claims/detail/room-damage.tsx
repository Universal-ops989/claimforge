import { isApiError } from "@claimforge/api-client";
import {
  useDeleteDamageItem,
  useRecordDamage,
  useUpdateDamageItem,
} from "@claimforge/api-client/react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogClose,
  DialogContent,
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
  Textarea,
} from "@claimforge/ui";
import { MoreHorizontal } from "lucide-react";
import { useId, useState } from "react";

import { useOrganization } from "../../app/organization";
import { errorCopy } from "../../app/states";
import {
  damageDetails,
  damageDraftOf,
  damageProblems,
  damageTitle,
  emptyDamageDraft,
  isBlackWater,
  isWater,
  SURFACE_LABEL,
  SURFACES,
  toDamageBody,
  WATER_CATEGORY_LABEL,
  WATER_CLASS_LABEL,
  type DamageDraft,
  type DamageField,
  type DamageItem,
} from "../damage";
import type { Room } from "../layout";
import { LOSS_TYPE_LABEL, type LossType } from "../status";
import { useClaimOfPage } from "./tabs";

/** A room a damage item can be moved to: its id, and a name to tell it by. */
export interface RoomChoice {
  id: string;
  label: string;
}

/** The damage recorded in a room; with `canWork`, recording, editing and deleting it. */
export function RoomDamage({
  room,
  items,
  rooms,
  canWork,
}: {
  room: Room;
  items: DamageItem[];
  rooms: RoomChoice[];
  canWork: boolean;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const remove = useDeleteDamageItem(organization.id, claim.id);
  const [editing, setEditing] = useState<DamageItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<DamageItem | null>(null);

  return (
    <Stack gap={2}>
      {items.length > 0 && (
        <Stack
          as="ul"
          gap={2}
          aria-label={`Damage in the ${room.name}`}
          style={{
            listStyle: "none",
            margin: 0,
            padding: "0 0 0 var(--cf-space-3)",
            borderInlineStart: "2px solid var(--cf-color-border)",
          }}
        >
          {items.map((item) => (
            <li key={item.id}>
              <Inline justify="between" align="start" gap={3}>
                <Stack gap={1}>
                  <Text size="sm">{damageTitle(item)}</Text>
                  <Text size="sm" tone="muted">
                    {damageDetails(item)}
                  </Text>
                  {item.description && (
                    <Text size="sm" tone="subtle" style={{ whiteSpace: "pre-line" }}>
                      {item.description}
                    </Text>
                  )}
                </Stack>
                {canWork && (
                  <Menu>
                    <MenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Change the ${damageTitle(item).toLowerCase()} damage`}
                      >
                        <MoreHorizontal size={16} aria-hidden="true" />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem
                        onSelect={() => {
                          setEditing(item);
                        }}
                      >
                        Edit
                      </MenuItem>
                      <MenuItem
                        tone="danger"
                        onSelect={() => {
                          setDeleting(item);
                        }}
                      >
                        Delete
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                )}
              </Inline>
            </li>
          ))}
        </Stack>
      )}
      {canWork && (
        <Inline>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Record damage in the ${room.name}`}
            onClick={() => {
              setEditing("new");
            }}
          >
            Record damage
          </Button>
        </Inline>
      )}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        {editing !== null && (
          <DamageForm
            item={editing === "new" ? null : editing}
            room={room}
            rooms={rooms}
            onDone={() => {
              setEditing(null);
            }}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        tone="danger"
        title={deleting ? `Delete the ${damageTitle(deleting).toLowerCase()} damage?` : ""}
        description="It comes off the claim's damage record."
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
          } catch (error) {
            throw new Error(message(error), { cause: error });
          }
        }}
      />
    </Stack>
  );
}

/** Not known: a select's stand-in for a blank water category or class. */
const UNKNOWN = "unknown";

function DamageForm({
  item,
  room,
  rooms,
  onDone,
}: {
  item: DamageItem | null;
  room: Room;
  rooms: RoomChoice[];
  onDone: () => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const record = useRecordDamage(organization.id, claim.id);
  const update = useUpdateDamageItem(organization.id, claim.id);
  const formId = useId();
  const [draft, setDraft] = useState<DamageDraft>(() =>
    item ? damageDraftOf(item) : emptyDamageDraft(room.id, claim.loss_type),
  );
  const [problems, setProblems] = useState<Partial<Record<DamageField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const set = (changes: Partial<DamageDraft>) => {
    setDraft((before) => ({ ...before, ...changes }));
  };
  const water = isWater(draft.cause);
  const black = isBlackWater(draft.cause);
  const title = item
    ? `Edit the ${damageTitle(item).toLowerCase()} damage`
    : `Record damage in the ${room.name}`;

  const save = async () => {
    const found = damageProblems(draft);
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0) return;
    const body = toDamageBody(draft);
    try {
      if (item) {
        await update.mutateAsync({
          itemId: item.id,
          changes: draft.room_id === item.room_id ? body : { ...body, room_id: draft.room_id },
        });
      } else {
        await record.mutateAsync({ roomId: draft.room_id, item: body });
      }
    } catch (error) {
      if (isApiError(error, "not_water_damage")) {
        setProblems({ cause: "Water category and class only go with water damage." });
      } else if (isApiError(error, "black_water_category")) {
        setProblems({ water_category: "Flood and sewage water is always Category 3." });
      } else {
        setFailure(message(error));
      }
      return;
    }
    onDone();
  };

  return (
    <DialogContent
      title={title}
      size="md"
      footer={
        <>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={record.isPending || update.isPending}
          >
            {item ? "Save changes" : "Record damage"}
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
          void save();
        }}
      >
        <Stack gap={4}>
          {failure && (
            <Text as="p" role="alert" tone="danger">
              {failure}
            </Text>
          )}
          <Grid minChildWidth="12rem" gap={4}>
            <FormField label="What's damaged" required error={problems.surface}>
              <Select
                placeholder="Choose one"
                options={SURFACES.map((s) => ({ value: s, label: SURFACE_LABEL[s] }))}
                value={draft.surface}
                onValueChange={(value) => {
                  set({ surface: value as DamageDraft["surface"] });
                }}
              />
            </FormField>
            <FormField label="Material" required error={problems.material}>
              <Input
                value={draft.material}
                onChange={(event) => {
                  set({ material: event.target.value });
                }}
              />
            </FormField>
          </Grid>
          <FormField label="Cause" error={problems.cause}>
            <Select
              options={(Object.keys(LOSS_TYPE_LABEL) as LossType[]).map((c) => ({
                value: c,
                label: LOSS_TYPE_LABEL[c],
              }))}
              value={draft.cause}
              onValueChange={(value) => {
                const cause = value as LossType;
                // Flood and sewage water is Category 3; leaving them, the category is open again.
                const leavingBlack = black && !isBlackWater(cause);
                set({
                  cause,
                  water_category: isBlackWater(cause)
                    ? "3"
                    : leavingBlack
                      ? ""
                      : draft.water_category,
                });
              }}
            />
          </FormField>
          {water && (
            <Grid minChildWidth="12rem" gap={4}>
              <FormField
                label="Water category"
                hint={
                  black ? "Flood and sewage water is always Category 3." : "How clean the water is"
                }
                error={problems.water_category}
              >
                <Select
                  disabled={black}
                  options={[
                    { value: UNKNOWN, label: "Not known" },
                    ...[1, 2, 3].map((n) => ({
                      value: String(n),
                      label: WATER_CATEGORY_LABEL[n] ?? "",
                    })),
                  ]}
                  value={draft.water_category || UNKNOWN}
                  onValueChange={(value) => {
                    set({ water_category: value === UNKNOWN ? "" : value });
                  }}
                />
              </FormField>
              <FormField
                label="Water class"
                hint="How much there is to dry"
                error={problems.water_class}
              >
                <Select
                  options={[
                    { value: UNKNOWN, label: "Not known" },
                    ...[1, 2, 3, 4].map((n) => ({
                      value: String(n),
                      label: WATER_CLASS_LABEL[n] ?? "",
                    })),
                  ]}
                  value={draft.water_class || UNKNOWN}
                  onValueChange={(value) => {
                    set({ water_class: value === UNKNOWN ? "" : value });
                  }}
                />
              </FormField>
            </Grid>
          )}
          <FormField
            label="Description"
            hint="Where, and how far: wet to 24 in. along the north wall"
            error={problems.description}
          >
            <Textarea
              rows={3}
              maxLength={2000}
              value={draft.description}
              onChange={(event) => {
                set({ description: event.target.value });
              }}
            />
          </FormField>
          {item && rooms.length > 1 && (
            <FormField label="Room">
              <Select
                options={rooms.map((r) => ({ value: r.id, label: r.label }))}
                value={draft.room_id}
                onValueChange={(value) => {
                  set({ room_id: value });
                }}
              />
            </FormField>
          )}
        </Stack>
      </form>
    </DialogContent>
  );
}

function message(error: unknown): string {
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled, so its damage record can't change.";
  }
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
