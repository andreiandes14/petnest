type ProductOrder = { status: string; fulfillmentMethod?: string; paymentStatus?: string; archived?: boolean;
  paymentAttemptState?: string; paymongoCheckoutSessionId?: string };
export function cashPickup(order: Pick<ProductOrder, "fulfillmentMethod" | "paymentStatus">) {
  return order.fulfillmentMethod === "PICKUP" && order.paymentStatus !== "PAID";
}
export function canCompleteProductOrder(order: ProductOrder) {
  if (order.archived) return false;
  if (order.status === "CONFIRMED" && order.paymentStatus === "PAID") return true;
  return cashPickup(order) && ["CONFIRMED", "READY_FOR_PICKUP"].includes(order.status) &&
    [undefined, "UNPAID", "FAILED"].includes(order.paymentStatus) && !order.paymongoCheckoutSessionId &&
    !["CREATING", "ACTIVE", "UNCERTAIN"].includes(order.paymentAttemptState ?? "");
}
