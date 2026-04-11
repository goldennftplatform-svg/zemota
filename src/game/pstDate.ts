/** Pacific time for “today” on scoreboards (handles DST). */
export const EMOTA_SCORE_TIMEZONE = "America/Los_Angeles";

export function calendarDayKeyInTimeZone(isoOrDate: string | Date, timeZone: string): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return y && mo && day ? `${y}-${mo}-${day}` : "";
}

export function calendarDayKeyPST(isoOrDate: string | Date): string {
  return calendarDayKeyInTimeZone(isoOrDate, EMOTA_SCORE_TIMEZONE);
}

export function todayCalendarKeyPST(): string {
  return calendarDayKeyPST(new Date());
}
