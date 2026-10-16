/** Scheduled booking dates are calendar dates, not instants in the device timezone. */
export function bookingDateParts(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return { full: "Date unavailable", day: "—", month: "" };
  }
  return {
    full: new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date),
    day: String(date.getUTCDate()),
    month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date),
  };
}
