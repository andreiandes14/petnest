export function canMarkNoShow(booking: {
  status: string; date: string; time: string; cancellationReason?: string | null;
  depositRequired?: boolean; paymentStatus?: string;
} | undefined, now = Date.now()): boolean {
  if (!booking || booking.status !== "confirmed" || booking.cancellationReason ||
      (booking.depositRequired && booking.paymentStatus !== "PAID")) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(booking.time)) return false;
  // Appointment dates are Philippine local dates, regardless of the device zone.
  const start = Date.parse(`${booking.date}T${booking.time}:00+08:00`);
  return Number.isFinite(start) && start <= now;
}

export function noShowExplanation(booking: Parameters<typeof canMarkNoShow>[0], now = Date.now()): string | undefined {
  if (canMarkNoShow(booking, now)) return undefined;
  if (!booking || booking.status !== "confirmed") return "This booking is no longer eligible for No-Show.";
  if (booking.cancellationReason) return "This booking includes prior cancellation notice. Please use the existing cancellation policy.";
  if (booking.depositRequired && booking.paymentStatus !== "PAID") return "The booking deposit must be verified before confirming No-Show.";
  const start = Date.parse(`${booking.date}T${booking.time}:00+08:00`);
  if (!Number.isFinite(start)) return "The appointment schedule is unavailable. Please review the booking.";
  const schedule = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).format(start);
  return `This appointment has not started yet. You can confirm No-Show on ${schedule} (Philippine time).`;
}
