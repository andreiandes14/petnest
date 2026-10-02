export function providerAddress(value: unknown): string {
  if (typeof value !== "string") return "";
  const address = value.trim().replace(/\s+/g, " ");
  return /^(undefined|null)$/i.test(address) ? "" : address;
}

export function providerMapUrl(value: unknown): string | null {
  const address = providerAddress(value);
  if (!address) return null;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", address);
  return url.href;
}
