// Calendar months preserve the day where possible, clamping at month end.
// This calculates a provider recommendation, never an available appointment.
export function vaccinationReturnTarget(completedDate: string, months: number): string {
  const date = new Date(`${completedDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(completedDate) ||
      !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== completedDate ||
      !Number.isInteger(months) || months < 1 || months > 120) {
    throw new Error("Choose a valid vaccination date and return period from 1 to 120 months.");
  }
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}
