import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Collection } from "mongodb";

export type PaymentFields = {
  paymentAttemptId?: string;
  paymentAttemptState?: "CREATING" | "ACTIVE" | "UNCERTAIN" | "FAILED" | "PAID";
  paymentAmountCentavos?: number;
  paymongoCheckoutSessionId?: string;
  paymongoCheckoutUrl?: string;
  paymongoPaymentReference?: string;
  paidAt?: string;
  paymentNotificationStatus?: "PENDING" | "SENT";
};
export type PaymentOrder = PaymentFields & {
  id: number; ownerId: string; customerId: string; providerId: number;
  status: string; archived?: boolean; total: number;
  paymentStatus?: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  paymentMethod?: "GCASH";
  items: Array<{ productName: string; price: number; quantity: number }>;
};
export class PaymentError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function checkoutEligible(order: Pick<PaymentOrder, "status" | "paymentStatus" | "archived">) {
  return order.status === "CONFIRMED" && order.archived !== true &&
    [undefined, "UNPAID", "FAILED", "PENDING"].includes(order.paymentStatus);
}

export function orderLineItems(order: Pick<PaymentOrder, "items" | "total">) {
  const lineItems = order.items.map(item => ({
    name: item.productName, amount: Math.round(item.price * 100), currency: "PHP", quantity: item.quantity,
  }));
  const amount = lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  if (!lineItems.length || lineItems.some(item => !item.name || !Number.isSafeInteger(item.amount) ||
      item.amount <= 0 || !Number.isSafeInteger(item.quantity) || item.quantity <= 0) ||
      !Number.isSafeInteger(amount) || amount <= 0 || !Number.isFinite(order.total) ||
      Math.round(order.total * 100) !== amount) {
    throw new PaymentError(409, "The saved order pricing needs review before payment.");
  }
  return { lineItems, amount };
}

export function safeCheckoutUrl(value: unknown): string {
  try {
    const url = new URL(String(value));
    if (url.protocol === "https:" && url.hostname === "checkout.paymongo.com" &&
        !url.username && !url.password && !url.port) return url.href;
  } catch { /* Invalid URLs are never returned to the browser. */ }
  throw new PaymentError(502, "PayMongo returned an invalid checkout. Please contact PetNest support.");
}

function returnUrl(base: string, orderId: number, result: "success" | "cancel") {
  let url: URL;
  try { url = new URL(base); } catch { throw new PaymentError(503, "Payment return URL is not configured."); }
  if (url.username || url.password || url.search || url.hash ||
      !(url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) {
    throw new PaymentError(503, "Payment return URL is not configured.");
  }
  url.pathname = `${url.pathname.replace(/\/$/, "")}/orders`;
  url.searchParams.set("payment", result);
  url.searchParams.set("order", String(orderId));
  return url.href;
}

export function paymentWebUrl(env: { APP_URL?: string; NODE_ENV?: string; VERCEL?: string }) {
  const deployed = env.NODE_ENV === "production" || env.VERCEL === "1";
  const base = env.APP_URL ?? (deployed ? "" : "http://localhost:5173");
  if (deployed) {
    let url: URL;
    try { url = new URL(base); } catch { throw new PaymentError(503, "Configure APP_URL with the deployed PetNest frontend HTTPS URL."); }
    if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      throw new PaymentError(503, "Configure APP_URL with the deployed PetNest frontend HTTPS URL.");
    }
  }
  return base;
}

export async function deliverPaymentNotifications<T extends PaymentOrder>(orders: Collection<T>, order: PaymentOrder,
  notify: (order: PaymentOrder) => Promise<void>) {
  if (order.paymentNotificationStatus === "SENT") return true;
  try {
    await notify(order);
    await orders.updateOne({ id: order.id, paymentStatus: "PAID", paymongoPaymentReference: order.paymongoPaymentReference,
    } as import("mongodb").Filter<T>, { $set: { paymentNotificationStatus: "SENT" } } as import("mongodb").UpdateFilter<T>);
    return true;
  } catch {
    // PENDING is persisted with the paid transition. A later order read or verified duplicate retries delivery.
    return false;
  }
}

export async function createOrderCheckout<T extends PaymentOrder>(
  orders: Collection<T>, orderId: number, userId: string,
  config: { secretKey?: string; webUrl: string }, request: typeof fetch = fetch,
) {
  const order = await orders.findOne({ id: orderId } as import("mongodb").Filter<T>);
  if (!order) throw new PaymentError(404, "Order not found.");
  if (order.ownerId !== userId || order.customerId !== userId) throw new PaymentError(403, "This order belongs to another customer.");
  if (!checkoutEligible(order)) throw new PaymentError(409, "Only confirmed, unpaid orders can be paid.");
  if (!config.secretKey?.startsWith("sk_test_") || config.secretKey.length <= 8) {
    throw new PaymentError(503, "PayMongo test payments are not configured.");
  }
  const { lineItems, amount } = orderLineItems(order);
  if (order.paymongoCheckoutSessionId && order.paymongoCheckoutUrl && order.paymentAttemptState === "ACTIVE") {
    // A hosted checkout is still unpaid; this also normalizes an earlier creating-state response.
    await orders.updateOne({ id: order.id, paymentAttemptId: order.paymentAttemptId,
      paymentStatus: "PENDING", paymentAttemptState: "ACTIVE",
    } as import("mongodb").Filter<T>, { $set: { paymentStatus: "UNPAID" } } as import("mongodb").UpdateFilter<T>);
    return { checkout_url: safeCheckoutUrl(order.paymongoCheckoutUrl) };
  }
  if (["CREATING", "UNCERTAIN"].includes(order.paymentAttemptState ?? "")) {
    throw new PaymentError(409, "Checkout creation is being verified. Please try later or contact PetNest support.");
  }
  // Compute configuration before locking. Never take a return URL or amount from the browser.
  const successUrl = returnUrl(config.webUrl, order.id, "success");
  const cancelUrl = returnUrl(config.webUrl, order.id, "cancel");
  const attemptId = `PETNEST-${order.id}-${randomUUID()}`;
  const filter = { id: order.id, ownerId: userId, status: "CONFIRMED", archived: { $ne: true },
    paymentStatus: { $nin: ["PAID", "CANCELLED"] },
    paymentAttemptState: { $nin: ["CREATING", "ACTIVE", "UNCERTAIN", "PAID"] } } as import("mongodb").Filter<T>;
  const locked = await orders.updateOne(filter, { $set: {
    paymentAttemptId: attemptId, paymentAttemptState: "CREATING", paymentStatus: "PENDING",
    paymentMethod: "GCASH", paymentAmountCentavos: amount,
  } } as import("mongodb").UpdateFilter<T>);
  if (!locked.modifiedCount) throw new PaymentError(409, "Payment is already being prepared. Please refresh your orders.");
  const attemptFilter = { id: order.id, paymentAttemptId: attemptId, paymentStatus: { $ne: "PAID" } } as import("mongodb").Filter<T>;
  let definitiveFailure = false;
  try {
    const response = await request("https://api.paymongo.com/v2/checkout_sessions", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Basic ${Buffer.from(`${config.secretKey}:`).toString("base64")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: { attributes: {
        line_items: lineItems, payment_method_types: ["gcash"], pass_on_fees: false,
        success_url: successUrl, cancel_url: cancelUrl, reference_number: attemptId,
        description: `PetNest Pet Supplies order #${order.id}`,
        metadata: { petnest_order_id: String(order.id), petnest_attempt_id: attemptId },
      } } }),
    });
    if (!response.ok) {
      // A timeout/server error may have created a session: keep the lock rather than charging twice.
      definitiveFailure = response.status >= 400 && response.status < 500 && ![408, 409].includes(response.status);
      throw new PaymentError(502, "PayMongo could not prepare the test checkout. Check that GCash test payments are enabled and try again.");
    }
    const result: any = await response.json();
    const session = result?.data;
    if (typeof session?.id !== "string" || !session.id.startsWith("cs_") || session.attributes?.livemode !== false) {
      throw new PaymentError(502, "PayMongo returned an invalid test checkout.");
    }
    const checkoutUrl = safeCheckoutUrl(session.attributes.checkout_url);
    await orders.updateOne(attemptFilter, { $set: {
      paymongoCheckoutSessionId: session.id, paymongoCheckoutUrl: checkoutUrl, paymentAttemptState: "ACTIVE", paymentStatus: "UNPAID",
    } } as import("mongodb").UpdateFilter<T>);
    // A webhook may have arrived while the create response was being persisted.
    const latest = await orders.findOne({ id: order.id } as import("mongodb").Filter<T>);
    if (latest?.paymentStatus === "PAID") throw new PaymentError(409, "This order is already paid. Refresh your orders.");
    return { checkout_url: checkoutUrl };
  } catch (error) {
    await orders.updateOne(attemptFilter, { $set: {
      paymentAttemptState: definitiveFailure ? "FAILED" : "UNCERTAIN",
      paymentStatus: definitiveFailure ? "FAILED" : "PENDING",
    } } as import("mongodb").UpdateFilter<T>);
    if (error instanceof PaymentError) throw error;
    // Do not propagate fetch errors, request headers, credentials or upstream response bodies.
    throw new PaymentError(502, "Checkout creation could not be confirmed. Please try later or contact PetNest support.");
  }
}

export function verifyPaymongoSignature(raw: Buffer, header: string | undefined, secret: string | undefined, now = Date.now()) {
  if (!secret) throw new PaymentError(503, "Payment webhook verification is not configured.");
  const parts = new Map<string, string>();
  for (const part of (header ?? "").split(",")) {
    const [name, value, extra] = part.trim().split("=");
    if (!name || value === undefined || extra !== undefined || parts.has(name)) throw new PaymentError(400, "Invalid payment signature.");
    parts.set(name, value);
  }
  const timestamp = parts.get("t") ?? "";
  const signature = parts.get("te") ?? "";
  if (!/^\d+$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature) ||
      Math.abs(now / 1000 - Number(timestamp)) > 300) throw new PaymentError(400, "Invalid payment signature.");
  const expected = createHmac("sha256", secret).update(`${timestamp}.`).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new PaymentError(400, "Invalid payment signature.");
}

export async function processPaidWebhook<T extends PaymentOrder>(orders: Collection<T>, payload: unknown,
  notify: (order: PaymentOrder) => Promise<void>) {
  const body = payload as any;
  // Official legacy event envelope and current Hosted Checkout V2 envelope.
  const event = body?.data?.attributes ?? body?.data;
  if (event?.livemode !== false) throw new PaymentError(400, "Only test payment events are accepted.");
  if (event?.type !== "checkout_session.payment.paid") return;
  const session = event.data;
  if (session?.type !== "checkout_session" || typeof session?.id !== "string" || !session.id.startsWith("cs_")) {
    throw new PaymentError(400, "Invalid checkout event.");
  }
  const attributes = session.attributes;
  if (attributes?.livemode === true || typeof attributes?.reference_number !== "string") throw new PaymentError(400, "Invalid checkout event.");
  const order = await orders.findOne({ paymentAttemptId: attributes.reference_number } as import("mongodb").Filter<T>);
  // Retry early deliveries rather than acknowledging an unknown association.
  if (!order) throw new PaymentError(409, "Checkout association is not available yet.");
  if (order.paymongoCheckoutSessionId && order.paymongoCheckoutSessionId !== session.id) throw new PaymentError(400, "Checkout association does not match.");
  if (attributes.metadata && (attributes.metadata.petnest_order_id !== String(order.id) ||
      attributes.metadata.petnest_attempt_id !== order.paymentAttemptId)) throw new PaymentError(400, "Checkout metadata does not match.");
  const { amount } = orderLineItems(order);
  const payments = Array.isArray(attributes.payments) ? attributes.payments : [];
  const paid = payments.filter((payment: any) => payment?.attributes?.status === "paid");
  if (order.paymentAmountCentavos !== amount || paid.length !== 1 ||
      typeof paid[0].id !== "string" || !paid[0].id.startsWith("pay_") ||
      paid[0].attributes.amount !== amount || paid[0].attributes.currency !== "PHP" ||
      paid[0].attributes.livemode === true || paid[0].attributes.source?.type !== "gcash") {
    throw new PaymentError(400, "Payment amount, currency or method does not match the order.");
  }
  if (order.paymentStatus === "PAID") {
    if (order.paymongoPaymentReference !== paid[0].id) throw new PaymentError(409, "Order already has another payment.");
  } else {
    if (order.status !== "CONFIRMED" || order.archived === true) throw new PaymentError(409, "Order is not eligible for this payment.");
    const result = await orders.updateOne({ id: order.id, status: "CONFIRMED", archived: { $ne: true },
      paymentAttemptId: order.paymentAttemptId, paymentStatus: { $in: ["PENDING", "UNPAID", "FAILED"] },
    } as import("mongodb").Filter<T>, { $set: {
      paymentStatus: "PAID", paymentAttemptState: "PAID", paymentMethod: "GCASH",
      paymongoCheckoutSessionId: session.id, paymongoPaymentReference: paid[0].id, paidAt: new Date().toISOString(),
      paymentNotificationStatus: "PENDING",
    }, $unset: { paymongoCheckoutUrl: "" } } as unknown as import("mongodb").UpdateFilter<T>);
    if (!result.modifiedCount) {
      const latest = await orders.findOne({ id: order.id } as import("mongodb").Filter<T>);
      if (latest?.paymentStatus !== "PAID" || latest.paymongoPaymentReference !== paid[0].id) throw new PaymentError(409, "Payment state changed. Please retry delivery.");
    }
  }
  const paidOrder = await orders.findOne({ id: order.id } as import("mongodb").Filter<T>);
  if (!paidOrder || paidOrder.paymentStatus !== "PAID") throw new PaymentError(503, "Payment persistence could not be confirmed.");
  // Secondary notification failure must not prevent acknowledgement of an already persisted payment.
  return { notificationsPending: !(await deliverPaymentNotifications(orders, paidOrder, notify)) };
}
