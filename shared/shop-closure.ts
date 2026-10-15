export function shopClosed(provider: { closedUntil?: string | null } | null | undefined, now = Date.now()): boolean {
  return Boolean(provider?.closedUntil && Date.parse(provider.closedUntil) > now);
}
export function nextManilaMidnight(now = Date.now()): string {
  const offset = 8 * 60 * 60 * 1000;
  const manila = new Date(now + offset);
  return new Date(Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate() + 1) - offset).toISOString();
}
