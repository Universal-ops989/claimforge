import type { Schema } from "@claimforge/api-client";

export type EquipmentKind = Schema<"EquipmentKind">;
export type Placement = Schema<"PlacementRead">;
type Unit = Schema<"EquipmentRead">;

/** Each kind of equipment as people say it. */
export const KIND_LABEL: Record<EquipmentKind, string> = {
  dehumidifier: "Dehumidifier",
  desiccant_dehumidifier: "Desiccant dehumidifier",
  air_mover: "Air mover",
  air_scrubber: "Air scrubber",
  heater: "Heater",
  other: "Other",
};

const CAPACITY_UNIT_LABEL: Record<Schema<"CapacityUnit">, string> = {
  pints_per_day: "pints/day",
  cfm: "CFM",
  btu_per_hour: "BTU/h",
};

/** A unit's rating: "145 pints/day", "2,400 CFM"; `null` when it has none. */
export function capacity(unit: Pick<Unit, "capacity" | "capacity_unit">): string | null {
  return unit.capacity === null || unit.capacity_unit === null
    ? null
    : `${unit.capacity.toLocaleString()} ${CAPACITY_UNIT_LABEL[unit.capacity_unit]}`;
}

/** How many days: "1 day", "3 days". */
export function days(count: number): string {
  return `${String(count)} ${count === 1 ? "day" : "days"}`;
}

/** A moment as a `datetime-local` value, in the browser's time zone: "2026-11-16T09:30". */
export function toLocalInput(iso: string | Date): string {
  const at = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

/** A `datetime-local` value back to an ISO moment; `null` for blank or unreadable. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}
