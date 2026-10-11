// Inclusive calendar-date window; UTC arithmetic avoids daylight-saving shifts.
export function vaccinationReturnWindow(target: string): { start: string; end: string } {
  const end = new Date(`${target}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target) || !Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== target) {
    throw new Error("Invalid recommended return date.");
  }
  end.setUTCDate(end.getUTCDate() + 10);
  return { start: target, end: end.toISOString().slice(0, 10) };
}
