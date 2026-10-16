type CustomerOrder = { status: string; paymentStatus?: string; fulfillmentMethod?: string };

/** Presentation only: provider acceptance and verified payment remain backend-owned. */
export function customerOrderStatus(order: CustomerOrder, waitingForPayment = false) {
  const status = order.status.trim().toUpperCase();
  const paymentStatus = (order.paymentStatus ?? "UNPAID").trim().toUpperCase();
  if (order.fulfillmentMethod === "PICKUP" && paymentStatus !== "PAID" && ["CONFIRMED", "READY_FOR_PICKUP"].includes(status)) {
    return { status: "READY_FOR_PICKUP", tone: "confirmed", canPay: false };
  }
  if (status !== "CONFIRMED") return { status, tone: status.toLowerCase(), canPay: false };
  if (paymentStatus === "PAID") return { status: "CONFIRMED", tone: "confirmed", canPay: false };
  if (paymentStatus === "PENDING" || waitingForPayment) {
    return { status: "PAYMENT_PROCESSING", tone: "processing", canPay: false };
  }
  return {
    status: "AWAITING_PAYMENT", tone: "pending",
    canPay: ["UNPAID", "FAILED"].includes(paymentStatus),
  };
}
