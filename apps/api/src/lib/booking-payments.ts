import type { Collection, Filter, UpdateFilter } from "mongodb";
import { PaymentError, type PaymentOrder, type PaymentFields, type PaymentRepository } from "./paymongo.js";
import { BOOKING_DEPOSIT } from "../../../../shared/booking-deposit.js";
export type PaymentBooking = PaymentFields & {
  id: number; ownerId: string; providerId: number; serviceName: string; price: number;
  depositRequired?: boolean; status: string; archived?: boolean;
  paymentStatus?: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "CANCELLED";
};
export function bookingPaymentRepository<T extends PaymentBooking>(bookings: Pick<Collection<T>, "findOne" | "updateOne">): PaymentRepository<PaymentOrder> {
  return {
    async findOne(filter) {
      const booking = await bookings.findOne(filter as unknown as Filter<T>);
      if (!booking) return null;
      if (!booking.depositRequired || !Number.isFinite(booking.price) || booking.price < BOOKING_DEPOSIT) throw new PaymentError(409, "This booking is not eligible for a deposit.");
      return { ...booking, paymentKind: "booking", customerId: booking.ownerId,
        status: ["awaiting_payment", "confirmed"].includes(booking.status) ? "CONFIRMED" : booking.status.toUpperCase(),
        total: BOOKING_DEPOSIT, items: [{ productName: `Booking #${booking.id} deposit`, price: BOOKING_DEPOSIT, quantity: 1 }] };
    },
    async updateOne(filter, update) {
      const mappedFilter = { ...filter, ...(filter.status === "CONFIRMED" ? { status: "awaiting_payment" } : {}) };
      const paid = update.$set?.paymentStatus === "PAID";
      const saved = paid ? await bookings.findOne(mappedFilter as unknown as Filter<T>) : null;
      if (paid && !saved) return { modifiedCount: 0 };
      const mappedUpdate = { ...update, $set: { ...update.$set, ...(paid ? { status: "confirmed", bookingDepositPaid: BOOKING_DEPOSIT, remainingServiceBalance: Math.max(0, saved!.price - BOOKING_DEPOSIT) } : {}) } };
      // Balance is derived from the immutable booking price; never accumulate deductions.
      return bookings.updateOne(mappedFilter as unknown as Filter<T>, mappedUpdate as unknown as UpdateFilter<T>);
    },
  };
}
