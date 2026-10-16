type BookingLink = { id: number; petId: number; providerId: number; serviceCategory: string; recordId: number | null };
type CourseRecord = { id: number; bookingId?: number; petId: number; providerId?: number; ownerId: string;
  type: string; vaccinationProgress?: "ongoing" | "completed" | "cancelled" | null };

/** Read-only join using explicit booking/record links, never vaccine names or dates. */
export function withVaccinationCourseStatus<T extends BookingLink>(bookings: readonly T[], records: readonly CourseRecord[], ownerId: string) {
  return bookings.map(booking => {
    if (booking.serviceCategory !== "vaccination") return booking;
    const relatedBookings = bookings.filter(b => b.serviceCategory === "vaccination" && b.petId === booking.petId && b.providerId === booking.providerId);
    const relatedRecords = records.filter(r => r.type === "vaccination" && r.ownerId === ownerId && r.petId === booking.petId &&
      (r.providerId === booking.providerId || (r.providerId === undefined && relatedBookings.some(b => b.id === r.bookingId))));
    const bookingIds = new Set([booking.id]);
    const recordIds = new Set<number>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of relatedBookings) {
        if (bookingIds.has(b.id) && b.recordId !== null && !recordIds.has(b.recordId)) { recordIds.add(b.recordId); changed = true; }
        if (b.recordId !== null && recordIds.has(b.recordId) && !bookingIds.has(b.id)) { bookingIds.add(b.id); changed = true; }
      }
      for (const r of relatedRecords) {
        if (r.bookingId !== undefined && bookingIds.has(r.bookingId) && !recordIds.has(r.id)) { recordIds.add(r.id); changed = true; }
        if (recordIds.has(r.id) && r.bookingId !== undefined && !bookingIds.has(r.bookingId)) { bookingIds.add(r.bookingId); changed = true; }
      }
    }
    const progress = relatedRecords.filter(r => recordIds.has(r.id)).map(r => r.vaccinationProgress);
    const vaccinationCourseStatus = progress.includes("cancelled") ? "cancelled" as const :
      progress.includes("completed") ? "completed" as const : progress.length ? "ongoing" as const : undefined;
    return { ...booking, vaccinationCourseStatus };
  });
}
