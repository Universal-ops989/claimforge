import type { Schema } from "@claimforge/api-client";
import type { BadgeTone } from "@claimforge/ui";

export type DryingState = Schema<"DryingStatus">;
export type MoistureScale = Schema<"MoistureScale">;
export type LogPoint = Schema<"DryingLogPoint">;
type AirIn = Schema<"AtmosphereIn">;

/** Each point's drying state as people say it. */
export const DRYING_LABEL: Record<DryingState, string> = {
  dry: "Dry",
  drying: "Drying",
  no_goal: "No goal",
  not_read: "Not read",
};

export const DRYING_TONE: Record<DryingState, BadgeTone> = {
  dry: "success",
  drying: "info",
  no_goal: "warning",
  not_read: "neutral",
};

export const SCALE_LABEL: Record<MoistureScale, string> = {
  percent: "Percent (%MC)",
  reference: "Reference scale",
};

/** A reading on its scale: "18%" on percent, "18" on a meter's reference scale. */
export function reading(value: number, scale: MoistureScale): string {
  const text = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return scale === "percent" ? `${text}%` : text;
}

/** A point's goal: "12% or less", or "No goal". */
export function goal(point: Pick<LogPoint, "dry_standard" | "scale">): string {
  return point.dry_standard === null
    ? "No goal"
    : `${reading(point.dry_standard, point.scale)} or less`;
}

/** A point's latest value from the drying log, if it's been read. */
export function latest(point: LogPoint): number | null {
  for (let i = point.values.length - 1; i >= 0; i -= 1) {
    const value = point.values[i];
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

/** A value as typed, checked: `null` for blank, a number to a tenth, or what's wrong. */
export function parseReading(
  text: string,
  { min, max }: { min: number; max: number },
): { value: number | null } | { problem: string } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < min || value > max) {
    return { problem: `Enter ${String(min)} to ${max.toLocaleString()}.` };
  }
  if (!/^-?\d*(\.\d)?$/.test(trimmed)) return { problem: "To a tenth at most." };
  return { value };
}

/** Where the air was read, as a visit's form lists it. */
export interface AirPlace {
  key: string;
  label: string;
  location: AirIn["location"];
  roomId: string | null;
}

/** A visit as its form holds it: text per point and per air place. */
export interface VisitDraft {
  readings: Record<string, string>;
  air: Record<string, { temperature: string; humidity: string }>;
  notes: string;
}

export interface VisitCheck {
  /** Problems by field key: a point's id, or `air:<place>:temperature|humidity`. */
  problems: Record<string, string>;
  body: Schema<"MoistureLogCreate"> | null;
}

/**
 * A visit's draft checked and turned into the API's body. Blank points and places aren't
 * recorded; a place needs both its temperature and humidity; something must be read.
 */
export function checkVisit(draft: VisitDraft, places: AirPlace[]): VisitCheck {
  const problems: Record<string, string> = {};
  const readings: Schema<"ReadingIn">[] = [];
  for (const [pointId, text] of Object.entries(draft.readings)) {
    const parsed = parseReading(text, { min: 0, max: 9999.9 });
    if ("problem" in parsed) problems[pointId] = parsed.problem;
    else if (parsed.value !== null) readings.push({ point_id: pointId, value: parsed.value });
  }
  const atmosphere: AirIn[] = [];
  for (const place of places) {
    const typed = draft.air[place.key] ?? { temperature: "", humidity: "" };
    const temperature = parseReading(typed.temperature, { min: -40, max: 160 });
    const humidity = parseReading(typed.humidity, { min: 0, max: 100 });
    const key = `air:${place.key}`;
    if ("problem" in temperature) problems[`${key}:temperature`] = temperature.problem;
    if ("problem" in humidity) problems[`${key}:humidity`] = humidity.problem;
    if ("problem" in temperature || "problem" in humidity) continue;
    if (temperature.value === null && humidity.value === null) continue;
    if (temperature.value === null) {
      problems[`${key}:temperature`] = "Enter the temperature too.";
    } else if (humidity.value === null) {
      problems[`${key}:humidity`] = "Enter the humidity too.";
    } else {
      atmosphere.push({
        location: place.location,
        ...(place.roomId ? { room_id: place.roomId } : {}),
        temperature_f: temperature.value,
        relative_humidity: humidity.value,
      });
    }
  }
  if (Object.keys(problems).length > 0) return { problems, body: null };
  if (readings.length === 0 && atmosphere.length === 0) {
    return { problems: { visit: "Enter at least one reading or the air." }, body: null };
  }
  const notes = draft.notes.trim();
  return { problems, body: { readings, atmosphere, ...(notes ? { notes } : {}) } };
}
