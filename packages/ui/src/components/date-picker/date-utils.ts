import { format, isValid, parse } from "date-fns";

/** A calendar date with no time or zone: "YYYY-MM-DD". */
export type IsoDate = string;

/** Local-midnight Date for an ISO date, or undefined when empty or invalid. */
export function fromIsoDate(value: IsoDate | null | undefined): Date | undefined {
  if (!value) return undefined;
  const date = parse(value, "yyyy-MM-dd", new Date());
  return isValid(date) ? date : undefined;
}

/** ISO date for a Date, using its local calendar day (never shifted by UTC conversion). */
export function toIsoDate(date: Date): IsoDate {
  return format(date, "yyyy-MM-dd");
}

/** Short human format, e.g. "Nov 2, 2026". */
export function formatDisplayDate(date: Date): string {
  return format(date, "MMM d, yyyy");
}
