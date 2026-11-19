import type { Schema } from "@claimforge/api-client";

export type Structure = Schema<"StructureRead">;
export type Room = Schema<"RoomRead">;

/** The largest dimension the API takes, in feet. */
const MAX_FEET = 9999.99;

/** A number of feet, square feet or cubic feet as people read it: "12.5", "1,200". */
export function amount(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** A room's name with its level: "Kitchen · Level 1", "Den · Basement". */
export function roomTitle(room: Room): string {
  if (!room.level) return room.name;
  return `${room.name} · ${/^\d+$/.test(room.level) ? `Level ${room.level}` : room.level}`;
}

/** A room's size: "12 × 10 ft, 8 ft high"; what's missing is left out, or "Not measured". */
export function roomSize(room: Room): string {
  const { length_ft: l, width_ft: w, height_ft: h } = room;
  const either = l ?? w;
  const plan =
    l !== null && w !== null
      ? `${amount(l)} × ${amount(w)} ft`
      : either !== null
        ? `${amount(either)} ft`
        : null;
  const high = h !== null ? `${amount(h)} ft high` : null;
  return [plan, high].filter(Boolean).join(", ") || "Not measured";
}

/** What the API works out from the size: "120 sq ft floor · 352 sq ft walls · 960 cu ft". */
export function roomMeasures(room: Room): string | null {
  const parts = [
    room.floor_area_sqft !== null ? `${amount(room.floor_area_sqft)} sq ft floor` : null,
    room.wall_area_sqft !== null ? `${amount(room.wall_area_sqft)} sq ft walls` : null,
    room.volume_cuft !== null ? `${amount(room.volume_cuft)} cu ft` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** A room as its form holds it: text while it's typed. */
export interface RoomDraft {
  structure_id: string;
  name: string;
  level: string;
  length_ft: string;
  width_ft: string;
  height_ft: string;
}

export type RoomField = keyof RoomDraft;

const DIMENSIONS = ["length_ft", "width_ft", "height_ft"] as const;

export function roomDraftOf(room: Room): RoomDraft {
  const text = (n: number | null) => (n === null ? "" : String(n));
  return {
    structure_id: room.structure_id,
    name: room.name,
    level: room.level ?? "",
    length_ft: text(room.length_ft),
    width_ft: text(room.width_ft),
    height_ft: text(room.height_ft),
  };
}

export function emptyRoomDraft(structureId: string): RoomDraft {
  return {
    structure_id: structureId,
    name: "",
    level: "",
    length_ft: "",
    width_ft: "",
    height_ft: "",
  };
}

/** What's wrong with a room draft, field by field, before the API is asked. */
export function roomProblems(draft: RoomDraft): Partial<Record<RoomField, string>> {
  const problems: Partial<Record<RoomField, string>> = {};
  const name = draft.name.trim();
  if (!name) problems.name = "Enter the room's name.";
  else if (name.length > 100) problems.name = "Keep this to 100 characters or fewer.";
  if (draft.level.trim().length > 40) problems.level = "Keep this to 40 characters or fewer.";
  for (const field of DIMENSIONS) {
    const raw = draft[field].trim();
    if (!raw) continue;
    const feet = Number(raw);
    if (!Number.isFinite(feet) || feet <= 0 || feet > MAX_FEET) {
      problems[field] = `Enter feet, more than 0 and up to ${amount(MAX_FEET)}.`;
    } else if (!/^\d*(\.\d{0,2})?$/.test(raw)) {
      problems[field] = "Feet to the hundredth at most (12.5 for 12' 6\").";
    }
  }
  return problems;
}

type RoomBody = Schema<"RoomUpdate">;

/** The API's body for a checked draft: blanks clear a dimension or the level. */
export function toRoomBody(draft: RoomDraft): RoomBody & { name: string } {
  const feet = (raw: string) => (raw.trim() ? Number(raw.trim()) : null);
  return {
    name: draft.name.trim(),
    level: draft.level.trim() || null,
    length_ft: feet(draft.length_ft),
    width_ft: feet(draft.width_ft),
    height_ft: feet(draft.height_ft),
  };
}
