export const BOOKING_DEPOSIT = 50;
export const DEPOSIT_NOTICE = "A \u20b150 booking deposit is required to secure your appointment. If you attend your scheduled appointment, this amount will be deducted from your total service fee. If you fail to attend without prior notice, the deposit will be forfeited and retained by the provider as a non-refundable no-show fee.";
export const DEPOSIT_ACKNOWLEDGMENT = "I understand that the \u20b150 booking deposit will be deducted from my total service fee and may be forfeited if I fail to attend my scheduled appointment without prior notice.";
export type BookingDeposit = {
  depositRequired?: boolean; paymentStatus?: string; price: number; status: string;
};
export function remainingBookingBalance(booking: BookingDeposit): number {
  if (booking.status === "no_show") return 0;
  return Math.max(0, booking.price - (booking.depositRequired && booking.paymentStatus === "PAID" ? BOOKING_DEPOSIT : 0));
}
