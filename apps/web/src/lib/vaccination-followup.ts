export function followupDisplayWindow(raw: string | undefined): number {
  const days = Number(raw ?? 30);
  return Number.isInteger(days) && days >= 1 && days <= 90 ? days : 30;
}

export function offsetDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function monthsInRange(start: string, end: string): string[] {
  const months: string[] = [];
  const date = new Date(`${start.slice(0, 7)}-01T00:00:00.000Z`);
  const last = end.slice(0, 7);
  while (date.toISOString().slice(0, 7) <= last) {
    months.push(date.toISOString().slice(0, 7));
    date.setUTCMonth(date.getUTCMonth() + 1);
  }
  return months;
}

export function availableFollowupDates(
  responses: { dates: Record<string, string[]> }[], start: string, end: string, today: string,
): string[] {
  return [...new Set(responses.flatMap((response) => Object.entries(response.dates)
    .filter(([date, times]) => date >= start && date <= end && date >= today && times.length > 0)
    .map(([date]) => date)))].sort();
}

export function closestFollowupDate(dates: string[], target: string): string | undefined {
  const targetTime = Date.parse(`${target}T00:00:00Z`);
  return [...dates].sort((a, b) =>
    Math.abs(Date.parse(`${a}T00:00:00Z`) - targetTime) -
    Math.abs(Date.parse(`${b}T00:00:00Z`) - targetTime) || a.localeCompare(b))[0];
}
