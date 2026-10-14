const weekdays: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const dayName = (value: string): number | null => {
  const day = value.toLowerCase();
  return /^(sun(day)?|mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?)$/.test(day) ? weekdays[day.slice(0, 3)] : null;
};
function clock(value: string): number | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (minute > 59 || (!match[3] && !match[2])) return null;
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[3].toUpperCase() === "PM" ? 12 : 0);
  } else if (hour > 23) return null;
  return hour * 60 + minute;
}
const formatClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export function parseBusinessHours(raw: string) {
  const value = raw.trim().replace(/[\u2013\u2014]/g, "-");
  const match = /^(.*?)(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)$/i.exec(value);
  if (!match) return null;
  const open = clock(match[2]), close = clock(match[3]);
  if (open === null || close === null || close <= open) return null;
  const prefix = match[1].trim().replace(/[\u00b7|:]\s*$/, "").trim();
  const workingDays = new Set<number>();
  if (!prefix || /^(daily|every day)$/i.test(prefix)) {
    for (let day = 0; day < 7; day++) workingDays.add(day);
  } else if (prefix.includes("-")) {
    const range = prefix.split(/\s*-\s*/);
    if (range.length !== 2) return null;
    const first = dayName(range[0]), last = dayName(range[1]);
    if (first === null || last === null) return null;
    for (let day = first; ; day = (day + 1) % 7) { workingDays.add(day); if (day === last) break; }
  } else {
    for (const token of prefix.split(/[\s,]+/)) {
      const day = dayName(token);
      if (day === null) return null;
      workingDays.add(day);
    }
  }
  return { open, close, workingDays, normalized: `${prefix ? `${prefix} \u00b7 ` : ""}${formatClock(open)}-${formatClock(close)}` };
}
export const businessHoursMessage = "Choose opening and closing times. Closing time must be later than opening time on the same day.";
// Retain the existing 30-minute legacy slot rule when no duration was configured.
export function bookingDuration(minutes: number | null | undefined): number | null {
  if (minutes === undefined || minutes === null) return 30;
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null;
}

export const businessTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const minutes = index * 30;
  return { value: formatClock(minutes), label: `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${minutes < 720 ? "AM" : "PM"}` };
});
export function selectedBusinessHours(opening: string, closing: string, previous: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(opening) || !/^\d{2}:\d{2}$/.test(closing)) return null;
  const saved = parseBusinessHours(previous);
  // Preserve any existing working-day restriction when editing only clock times.
  const prefix = saved ? saved.normalized.slice(0, -11) : "";
  const hours = parseBusinessHours(`${prefix}${opening}-${closing}`);
  return hours?.normalized ?? null;
}
export function savedBusinessTimes(hours: string) {
  const saved = parseBusinessHours(hours);
  return { opening: saved ? formatClock(saved.open) : "", closing: saved ? formatClock(saved.close) : "" };
}
