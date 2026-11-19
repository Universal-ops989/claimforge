import { isApiError, type Schema } from "@claimforge/api-client";
import {
  useCreateMoistureLog,
  useCreateMoisturePoint,
  useDeleteMoisturePoint,
  useDryingLog,
  useDryingStatus,
  useStructures,
  useUpdateMoisturePoint,
} from "@claimforge/api-client/react";
import {
  Badge,
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
  Heading,
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
  Textarea,
} from "@claimforge/ui";
import { MoreHorizontal } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { useOrganization } from "../../app/organization";
import { errorCopy, QueryView } from "../../app/states";
import { fullTime } from "../../format/relative-time";
import { SURFACE_LABEL, SURFACES, type Surface } from "../damage";
import {
  checkVisit,
  DRYING_LABEL,
  DRYING_TONE,
  goal,
  latest,
  parseReading,
  reading,
  SCALE_LABEL,
  type AirPlace,
  type LogPoint,
  type MoistureScale,
  type VisitDraft,
} from "../moisture";
import { READ_ONLY_STATUSES } from "../status";
import { useClaimOfPage } from "./tabs";

type LogRoom = Schema<"DryingLogRoom">;

type Open =
  | { kind: "map" }
  | { kind: "edit"; point: LogPoint; roomId: string }
  | { kind: "visit" }
  | { kind: "delete"; point: LogPoint }
  | null;

/** Moisture mapping and monitoring: how drying is going, the points by room, and visits. */
export function MoistureTab() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const log = useDryingLog(organization.id, claim.id);
  const canWork =
    organization.permissions.includes("field_data:write") &&
    !READ_ONLY_STATUSES.includes(claim.status);
  const [open, setOpen] = useState<Open>(null);
  const close = () => {
    setOpen(null);
  };

  return (
    <Stack gap={4}>
      <DryingStatusCard />
      {canWork && (
        <Inline justify="end" gap={3}>
          <Button
            variant="secondary"
            onClick={() => {
              setOpen({ kind: "map" });
            }}
          >
            Map a point
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setOpen({ kind: "visit" });
            }}
          >
            Log a visit
          </Button>
        </Inline>
      )}
      <QueryView query={log} loading={<SkeletonText lines={4} />}>
        {(data) =>
          data.rooms.length === 0 ? (
            <EmptyState
              headingLevel={2}
              title="No moisture points yet"
              description="Map the wet materials as points, then read them on each visit until they're dry."
            />
          ) : (
            <Stack gap={4}>
              {data.rooms.map((room) => (
                <RoomPoints key={room.id} room={room} canWork={canWork} onOpen={setOpen} />
              ))}
            </Stack>
          )
        }
      </QueryView>
      <Dialog
        open={open?.kind === "map" || open?.kind === "edit" || open?.kind === "visit"}
        onOpenChange={(next) => {
          if (!next) close();
        }}
      >
        {open?.kind === "map" && <PointForm point={null} roomId={null} onDone={close} />}
        {open?.kind === "edit" && (
          <PointForm point={open.point} roomId={open.roomId} onDone={close} />
        )}
        {open?.kind === "visit" && <VisitForm rooms={log.data?.rooms ?? []} onDone={close} />}
      </Dialog>
      <DeletePoint point={open?.kind === "delete" ? open.point : null} onClose={close} />
    </Stack>
  );
}

/** How many points are where, the last visit, and what needs attention. */
function DryingStatusCard() {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const status = useDryingStatus(organization.id, claim.id);
  return (
    <Card role="region" aria-label="Drying status">
      <CardHeader headingLevel={2} title="Drying status" />
      <CardBody>
        <QueryView query={status} loading={<SkeletonText lines={2} />}>
          {({ summary, alerts }) => (
            <Stack gap={3}>
              <Text>
                {summary.points === 0
                  ? "No points mapped yet."
                  : summary.all_dry
                    ? summary.points === 1
                      ? "The point is dry."
                      : `All ${String(summary.points)} points are dry.`
                    : [
                        `${String(summary.dry)} of ${String(summary.points)} dry`,
                        summary.drying > 0 ? `${String(summary.drying)} drying` : null,
                        summary.no_goal > 0 ? `${String(summary.no_goal)} without a goal` : null,
                        summary.not_read > 0 ? `${String(summary.not_read)} not read yet` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
              </Text>
              {summary.last_visit_at && (
                <Text size="sm" tone="muted">
                  Last visit {fullTime(summary.last_visit_at)}
                </Text>
              )}
              {alerts.length > 0 && (
                <Stack gap={1}>
                  <Heading level={3} size="sm">
                    Needs attention
                  </Heading>
                  <Stack
                    as="ul"
                    gap={1}
                    aria-label="Needs attention"
                    style={{ margin: 0, paddingInlineStart: "1.25rem" }}
                  >
                    {alerts.map((alert) => (
                      <li key={`${alert.kind}-${alert.point?.id ?? alert.room?.id ?? ""}`}>
                        <Text size="sm" tone="warning">
                          {alert.message}
                        </Text>
                      </li>
                    ))}
                  </Stack>
                </Stack>
              )}
            </Stack>
          )}
        </QueryView>
      </CardBody>
    </Card>
  );
}

function RoomPoints({
  room,
  canWork,
  onOpen,
}: {
  room: LogRoom;
  canWork: boolean;
  onOpen: (open: Open) => void;
}) {
  return (
    <Card role="region" aria-label={room.name}>
      <CardHeader headingLevel={2} title={room.name} />
      <CardBody>
        <Stack
          as="ul"
          gap={3}
          aria-label={`Moisture points in the ${room.name}`}
          style={{ listStyle: "none", margin: 0, padding: 0 }}
        >
          {room.points.map((point) => {
            const value = latest(point);
            return (
              <li key={point.id}>
                <Inline justify="between" align="start" gap={3}>
                  <Stack gap={1}>
                    <Inline gap={2} align="center">
                      <Text>{`Point ${point.label}`}</Text>
                      <Badge tone={DRYING_TONE[point.status]} size="sm">
                        {DRYING_LABEL[point.status]}
                      </Badge>
                    </Inline>
                    <Text size="sm" tone="muted">
                      {`${point.material} · ${SURFACE_LABEL[point.surface]} · goal ${goal(point)}`}
                    </Text>
                    <Text size="sm">
                      {value === null ? "Not read yet" : `Latest ${reading(value, point.scale)}`}
                    </Text>
                  </Stack>
                  {canWork && (
                    <Menu>
                      <MenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Change point ${point.label}`}
                        >
                          <MoreHorizontal size={16} aria-hidden="true" />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem
                          onSelect={() => {
                            onOpen({ kind: "edit", point, roomId: room.id });
                          }}
                        >
                          Edit
                        </MenuItem>
                        <MenuItem
                          tone="danger"
                          onSelect={() => {
                            onOpen({ kind: "delete", point });
                          }}
                        >
                          Delete
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  )}
                </Inline>
              </li>
            );
          })}
        </Stack>
      </CardBody>
    </Card>
  );
}

/** Map a new point, or edit one (its scale can't change: readings wouldn't compare). */
function PointForm({
  point,
  roomId,
  onDone,
}: {
  point: LogPoint | null;
  roomId: string | null;
  onDone: () => void;
}) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const layout = useStructures(organization.id, claim.id);
  const create = useCreateMoisturePoint(organization.id, claim.id);
  const update = useUpdateMoisturePoint(organization.id, claim.id);
  const [room, setRoom] = useState(roomId ?? "");
  const [label, setLabel] = useState(point?.label ?? "");
  const [material, setMaterial] = useState(point?.material ?? "");
  const [surface, setSurface] = useState<Surface | "">(point?.surface ?? "");
  const [scale, setScale] = useState<MoistureScale>(point?.scale ?? "percent");
  const [standard, setStandard] = useState(
    point?.dry_standard === null || point?.dry_standard === undefined
      ? ""
      : String(point.dry_standard),
  );
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const rooms = (layout.data ?? []).flatMap((s) =>
    s.rooms.map((r) => ({
      value: r.id,
      label: layout.data && layout.data.length > 1 ? `${r.name} (${s.name})` : r.name,
    })),
  );

  const save = async () => {
    const found: Record<string, string> = {};
    if (!room) found.room = "Choose the room.";
    if (!material.trim()) found.material = "Enter the material: drywall, subfloor…";
    if (!surface) found.surface = "Choose the surface.";
    if (label.trim().length > 20) found.label = "Keep this to 20 characters or fewer.";
    const goalValue = parseReading(standard, { min: 0, max: 9999.9 });
    if ("problem" in goalValue) found.standard = goalValue.problem;
    setProblems(found);
    setFailure(null);
    if (Object.keys(found).length > 0 || "problem" in goalValue || !surface) return;
    const common = {
      room_id: room,
      material: material.trim(),
      surface,
      dry_standard: goalValue.value,
      // A goal typed here is the technician's own, not read off a reference.
      ...(goalValue.value !== null && goalValue.value !== point?.dry_standard
        ? { dry_standard_basis: "manual" as const }
        : {}),
    };
    try {
      if (point) {
        await update.mutateAsync({
          pointId: point.id,
          changes: { ...common, ...(label.trim() ? { label: label.trim() } : {}) },
        });
      } else {
        await create.mutateAsync({
          ...common,
          scale,
          ...(label.trim() ? { label: label.trim() } : {}),
        });
      }
    } catch (error) {
      if (isApiError(error, "label_taken")) setProblems({ label: "Another point has this label." });
      else setFailure(message(error));
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title={point ? `Edit point ${point.label}` : "Map a moisture point"}
      submitLabel={point ? "Save changes" : "Map point"}
      pending={create.isPending || update.isPending}
      failure={failure}
      onSubmit={save}
    >
      <Grid minChildWidth="12rem" gap={4}>
        <FormField label="Room" required error={problems.room}>
          <Select placeholder="Choose one" options={rooms} value={room} onValueChange={setRoom} />
        </FormField>
        <FormField
          label="Label"
          hint="As on the moisture map; numbered for you if blank"
          error={problems.label}
        >
          <Input
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
        </FormField>
        <FormField label="Material" required error={problems.material}>
          <Input
            value={material}
            onChange={(event) => {
              setMaterial(event.target.value);
            }}
          />
        </FormField>
        <FormField label="Surface" required error={problems.surface}>
          <Select
            placeholder="Choose one"
            options={SURFACES.map((s) => ({ value: s, label: SURFACE_LABEL[s] }))}
            value={surface}
            onValueChange={(value) => {
              setSurface(value as Surface);
            }}
          />
        </FormField>
        <FormField
          label="Scale"
          hint={
            point ? "Can't change: readings on two scales don't compare" : "What the meter reads in"
          }
        >
          <Select
            disabled={point !== null}
            options={(Object.keys(SCALE_LABEL) as MoistureScale[]).map((s) => ({
              value: s,
              label: SCALE_LABEL[s],
            }))}
            value={scale}
            onValueChange={(value) => {
              setScale(value as MoistureScale);
            }}
          />
        </FormField>
        <FormField
          label="Dry standard"
          hint="Dry at or below this reading"
          error={problems.standard}
        >
          <Input
            inputMode="decimal"
            value={standard}
            suffix={scale === "percent" ? "%" : undefined}
            onChange={(event) => {
              setStandard(event.target.value);
            }}
          />
        </FormField>
      </Grid>
    </FormDialog>
  );
}

/** One visit: a reading for each point, and the air outdoors, unaffected and in each room. */
function VisitForm({ rooms, onDone }: { rooms: LogRoom[]; onDone: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const create = useCreateMoistureLog(organization.id, claim.id);
  const places: AirPlace[] = [
    { key: "outdoors", label: "Outdoors", location: "outdoors", roomId: null },
    { key: "unaffected", label: "Unaffected area", location: "unaffected", roomId: null },
    ...rooms.map((r) => ({ key: r.id, label: r.name, location: "room" as const, roomId: r.id })),
  ];
  const [draft, setDraft] = useState<VisitDraft>({ readings: {}, air: {}, notes: "" });
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);

  const setReading = (pointId: string, text: string) => {
    setDraft((d) => ({ ...d, readings: { ...d.readings, [pointId]: text } }));
  };
  const setAir = (key: string, part: "temperature" | "humidity", text: string) => {
    setDraft((d) => {
      const before = d.air[key] ?? { temperature: "", humidity: "" };
      return { ...d, air: { ...d.air, [key]: { ...before, [part]: text } } };
    });
  };

  const save = async () => {
    const checked = checkVisit(draft, places);
    setProblems(checked.problems);
    setFailure(null);
    if (!checked.body) return;
    try {
      await create.mutateAsync(checked.body);
    } catch (error) {
      setFailure(message(error));
      return;
    }
    onDone();
  };

  return (
    <FormDialog
      title="Log a visit"
      submitLabel="Save visit"
      pending={create.isPending}
      failure={problems.visit ?? failure}
      onSubmit={save}
      size="lg"
    >
      {rooms.map((room) => (
        <fieldset key={room.id} style={{ border: 0, margin: 0, padding: 0 }}>
          <legend>
            <Heading level={3} size="sm">
              {room.name}
            </Heading>
          </legend>
          <Grid minChildWidth="10rem" gap={3}>
            {room.points.map((point) => (
              <FormField
                key={point.id}
                label={`Point ${point.label}`}
                hint={`${point.material}, ${point.scale === "percent" ? "%" : "reference"}`}
                error={problems[point.id]}
              >
                <Input
                  inputMode="decimal"
                  value={draft.readings[point.id] ?? ""}
                  onChange={(event) => {
                    setReading(point.id, event.target.value);
                  }}
                />
              </FormField>
            ))}
          </Grid>
        </fieldset>
      ))}
      <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
        <legend>
          <Heading level={3} size="sm">
            The air
          </Heading>
        </legend>
        <Stack gap={3}>
          {places.map((place) => (
            <Grid key={place.key} minChildWidth="10rem" gap={3}>
              <FormField
                label={`${place.label} temperature`}
                error={problems[`air:${place.key}:temperature`]}
              >
                <Input
                  inputMode="decimal"
                  suffix="°F"
                  value={draft.air[place.key]?.temperature ?? ""}
                  onChange={(event) => {
                    setAir(place.key, "temperature", event.target.value);
                  }}
                />
              </FormField>
              <FormField
                label={`${place.label} humidity`}
                error={problems[`air:${place.key}:humidity`]}
              >
                <Input
                  inputMode="decimal"
                  suffix="% RH"
                  value={draft.air[place.key]?.humidity ?? ""}
                  onChange={(event) => {
                    setAir(place.key, "humidity", event.target.value);
                  }}
                />
              </FormField>
            </Grid>
          ))}
        </Stack>
      </fieldset>
      <FormField label="Notes">
        <Textarea
          rows={2}
          value={draft.notes}
          onChange={(event) => {
            setDraft((d) => ({ ...d, notes: event.target.value }));
          }}
        />
      </FormField>
    </FormDialog>
  );
}

function DeletePoint({ point, onClose }: { point: LogPoint | null; onClose: () => void }) {
  const claim = useClaimOfPage();
  const organization = useOrganization();
  const remove = useDeleteMoisturePoint(organization.id, claim.id);
  return (
    <ConfirmDialog
      open={point !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      tone="danger"
      title={point ? `Delete point ${point.label}?` : ""}
      description="Its readings go with it, from every visit."
      confirmLabel="Delete"
      cancelLabel="Keep it"
      onConfirm={async () => {
        if (!point) return;
        try {
          await remove.mutateAsync(point.id);
        } catch (error) {
          throw new Error(message(error), { cause: error });
        }
      }}
    />
  );
}

/** A dialog around a form: the fields, a failure above them, Cancel and submit below. */
function FormDialog({
  title,
  submitLabel,
  pending,
  failure,
  onSubmit,
  size = "md",
  children,
}: {
  title: string;
  submitLabel: string;
  pending: boolean;
  failure: string | null;
  onSubmit: () => Promise<void>;
  size?: "md" | "lg";
  children: ReactNode;
}) {
  const formId = useId();
  return (
    <DialogContent
      title={title}
      size={size}
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

function message(error: unknown): string {
  if (isApiError(error, "claim_locked")) {
    return "The claim was closed or cancelled, so its moisture records can't change.";
  }
  if (isApiError(error, "taken_in_future")) return "A visit can't be from the future.";
  const copy = errorCopy(error);
  return `${copy.title}. ${copy.description}`;
}
