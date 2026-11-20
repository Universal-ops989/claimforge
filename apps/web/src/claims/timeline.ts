import type { Schema } from "@claimforge/api-client";

export type TimelineKind = Schema<"TimelineKind">;
type Entry = Schema<"TimelineEntry">;

/** Each kind of event as people say it, in the order the filters offer them. */
export const KIND_LABEL: Record<TimelineKind, string> = {
  status: "Status",
  claim: "Claim details",
  team: "Team",
  contacts: "Contacts",
  layout: "Rooms",
  damage: "Damage",
  photos: "Photos",
  documents: "Documents",
  moisture: "Moisture",
  equipment: "Equipment",
  estimates: "Estimates",
  reports: "Reports",
  notes: "Notes",
  tasks: "Tasks",
  other: "Other",
};

const KINDS = Object.keys(KIND_LABEL) as TimelineKind[];

/** The kinds chosen in an address (`?kind=status&kind=photos`); unknown ones dropped. */
export function readKinds(params: URLSearchParams): TimelineKind[] {
  const asked = params.getAll("kind");
  return KINDS.filter((kind) => asked.includes(kind));
}

/** `params` with `kinds` written in; anything else in the address stays. */
export function writeKinds(params: URLSearchParams, kinds: TimelineKind[]): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete("kind");
  for (const kind of KINDS.filter((k) => kinds.includes(k))) next.append("kind", kind);
  return next;
}

/** The day a moment fell on, where the browser is, as `YYYY-MM-DD`. */
function localDay(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** A day's heading: "Today", "Yesterday", or "Nov 16, 2026". */
export function dayLabel(day: string, now: Date): string {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localDay(now)) return "Today";
  if (day === localDay(yesterday)) return "Yesterday";
  return new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" });
}

/** Entries (newest first) in runs by the day they happened, newest day first. */
export function byDay(entries: readonly Entry[]): { day: string; entries: Entry[] }[] {
  const days: { day: string; entries: Entry[] }[] = [];
  for (const entry of entries) {
    const day = localDay(new Date(entry.at));
    const last = days.at(-1);
    if (last?.day === day) last.entries.push(entry);
    else days.push({ day, entries: [entry] });
  }
  return days;
}
