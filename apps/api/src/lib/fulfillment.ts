export const fulfillmentMethods = ["PICKUP", "DELIVERY"] as const;

export type FulfillmentMethod = (typeof fulfillmentMethods)[number];

export const defaultFulfillmentMethods: FulfillmentMethod[] = ["PICKUP"];

export function supportedFulfillmentMethods(
  configured: readonly FulfillmentMethod[] | undefined,
): FulfillmentMethod[] {
  return configured?.includes("DELIVERY")
    ? ["PICKUP", "DELIVERY"]
    : ["PICKUP"];
}

export function supportsFulfillmentMethod(
  configured: readonly FulfillmentMethod[] | undefined,
  requested: FulfillmentMethod,
): boolean {
  return supportedFulfillmentMethods(configured).includes(requested);
}

export function hasValidFulfillmentConfiguration(
  configured: readonly FulfillmentMethod[] | undefined,
  hasActiveProducts: boolean,
): boolean {
  return !hasActiveProducts || supportedFulfillmentMethods(configured).length > 0;
}
