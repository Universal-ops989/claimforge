const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/**
 * How long ago (or until) `when` is, in words: "3 hours ago", "yesterday", "in 2 days".
 * Under a minute reads as "just now".
 */
export function relativeTime(when: string | Date, now: Date = new Date(), locale?: string): string {
  const seconds = (new Date(when).getTime() - now.getTime()) / 1000;
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return format.format(Math.round(seconds / size), unit);
    }
  }
  return "just now";
}

/** `when` in full, for a tooltip or a screen reader: "Nov 17, 2026, 9:30 AM". */
export function fullTime(when: string | Date, locale?: string): string {
  return new Date(when).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
