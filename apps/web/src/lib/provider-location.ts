export function providerAddress(value: unknown): string {
  if (typeof value !== "string") return "";
  const address = value.trim().replace(/\s+/g, " ");
  return /^(undefined|null)$/i.test(address) ? "" : address;
}

export function providerMapUrl(value: unknown, pin?: { latitude?: number | null; longitude?: number | null; locationAccuracy?: string | null }): string | null {
  const address = providerAddress(value);
  const hasPin = pin && pin.locationAccuracy !== "city" && typeof pin.latitude === "number" && Number.isFinite(pin.latitude) && Math.abs(pin.latitude) <= 90 && typeof pin.longitude === "number" && Number.isFinite(pin.longitude) && Math.abs(pin.longitude) <= 180;
  if (!address && !hasPin) return null;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", hasPin ? `${pin.latitude},${pin.longitude}` : address);
  return url.href;
}
