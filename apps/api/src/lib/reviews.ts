export type ReviewBooking = { id: number; ownerId: string; providerId: number; status: string; serviceCategory: string };
export function reviewEligible(booking: ReviewBooking | null, customerId: string, providerId: number) {
  return !!booking && booking.ownerId === customerId && booking.providerId === providerId &&
    booking.status === "completed" && ["grooming", "vaccination"].includes(booking.serviceCategory);
}
export function validReviewInput(body: Record<string, unknown>) {
  return typeof body.bookingId === "number" && Number.isSafeInteger(body.bookingId) && body.bookingId > 0 &&
    typeof body.rating === "number" && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5 &&
    typeof body.comment === "string" && body.comment.trim().length > 0 && body.comment.trim().length <= 1000;
}
