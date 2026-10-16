export type BookingServiceFilter = "all" | "grooming" | "vaccination";

export function customerBookingSections<T extends {
  id: number; serviceCategory: string; status: string; date: string; time: string;
}>(bookings: readonly T[], service: BookingServiceFilter) {
  const filtered = bookings.filter(booking => service === "all" || booking.serviceCategory === service);
  const isPast = (booking: T) => ["completed", "cancelled", "no_show"].includes(booking.status.toLowerCase());
  // ISO calendar dates and HH:mm times sort without any timezone conversion.
  const byAppointment = (a: T, b: T) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time) || a.id - b.id;
  return {
    upcoming: filtered.filter(booking => !isPast(booking)).sort(byAppointment),
    past: filtered.filter(isPast).sort((a, b) => byAppointment(b, a)),
  };
}
