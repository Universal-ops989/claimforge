/**
 * A calendar date from the API (`2026-11-10`) in words: "Nov 10, 2026". Read as a day,
 * not a moment, so no time zone moves it to the day before.
 */
export function calendarDate(date: string, locale?: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(locale, { dateStyle: "medium" });
}
