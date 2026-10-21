export const defaultOperatingDays = [0, 1, 2, 3, 4, 5, 6];
export function scheduledClosed(provider: { operatingDays?: number[] } | null | undefined, now = Date.now()): boolean {
  const day = new Date(now + 8 * 60 * 60 * 1000).getUTCDay();
  return !(provider?.operatingDays ?? defaultOperatingDays).includes(day);
}
export function operatingDaysLabel(days = defaultOperatingDays): string {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter(day => days.includes(day));
  return ordered.length === 7 ? "Monday?Sunday" : ordered.map(day => names[day]).join(", ");
}
export function shopClosed(provider: { closedUntil?: string | null; operatingDays?: number[] } | null | undefined, now = Date.now()): boolean {
  return scheduledClosed(provider, now) || Boolean(provider?.closedUntil && Date.parse(provider.closedUntil) > now);
}
export function nextManilaMidnight(now = Date.now()): string {
  const offset = 8 * 60 * 60 * 1000;
  const manila = new Date(now + offset);
  return new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate() + 1) - offset).toISOString();
}
