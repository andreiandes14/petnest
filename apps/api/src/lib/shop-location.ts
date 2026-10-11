import { normalizeCity } from "../../../../shared/city-location.js";
export type CityLocation = { latitude: number; longitude: number };
export function photonCityResult(value: unknown, city: string): CityLocation | null {
  if (!value || typeof value !== "object") return null;
  const features = (value as Record<string, unknown>).features;
  if (!Array.isArray(features)) return null;
  const isCity = /\bcity\b/i.test(city);
  const converted = features.flatMap((feature: unknown) => {
    if (!feature || typeof feature !== "object") return [];
    const item = feature as Record<string, unknown>;
    if (!item.properties || typeof item.properties !== "object" || !item.geometry || typeof item.geometry !== "object") return [];
    const properties = item.properties as Record<string, unknown>;
    const geometry = item.geometry as Record<string, unknown>;
    const coordinates = geometry.coordinates;
    if (String(properties.countrycode).toUpperCase() !== "PH" || geometry.type !== "Point" || !Array.isArray(coordinates) || coordinates.length !== 2 || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return [];
    if (isCity && properties.osm_value !== "city") return [];
    return [{ name: properties.name, addresstype: properties.osm_value,
      lon: String(coordinates[0]), lat: String(coordinates[1]), address: { state: properties.state } }];
  });
  return cityGeocodingResult(converted, city);
}
type SavedLocation = { locationCity?: string | null; locationAccuracy?: string | null; latitude?: number | null; longitude?: number | null; cityLatitude?: number | null; cityLongitude?: number | null };
export function validPin(pin: { latitude?: number | null; longitude?: number | null }): pin is CityLocation {
  return typeof pin.latitude === "number" && Number.isFinite(pin.latitude) && Math.abs(pin.latitude) <= 90 && typeof pin.longitude === "number" && Number.isFinite(pin.longitude) && Math.abs(pin.longitude) <= 180;
}
export async function providerLocationUpdate(previous: SavedLocation, city: string | null, resolve: (city: string) => Promise<CityLocation | null>, selectedPin?: CityLocation) {
  if (selectedPin && (!city || !validPin(selectedPin))) throw new Error("Select a valid shop pin for the current city.");
  const approximate = await cityLocationUpdate({ ...previous, locationAccuracy: "city", latitude: previous.cityLatitude ?? (previous.locationAccuracy === "city" ? previous.latitude : null), longitude: previous.cityLongitude ?? (previous.locationAccuracy === "city" ? previous.longitude : null) }, city, resolve);
  const sameCity = city && previous.locationCity && normalizeCity(city) === normalizeCity(previous.locationCity);
  const exact = selectedPin ?? (sameCity && previous.locationAccuracy === "shop" && validPin(previous) ? { latitude: previous.latitude, longitude: previous.longitude } : null);
  return { ...approximate, cityLatitude: approximate.latitude, cityLongitude: approximate.longitude,
    ...(exact ? { ...exact, locationAccuracy: "shop" as const } : {}) };
}
export async function cityLocationUpdate(previous: { locationCity?: string | null; locationAccuracy?: string | null; latitude?: number | null; longitude?: number | null }, city: string | null, resolve: (city: string) => Promise<CityLocation | null>) {
  const sameCity = city && previous.locationCity && normalizeCity(city) === normalizeCity(previous.locationCity);
  let pin: CityLocation | null = sameCity && previous.locationAccuracy === "city" && typeof previous.latitude === "number" && Number.isFinite(previous.latitude) && Math.abs(previous.latitude) <= 90 && typeof previous.longitude === "number" && Number.isFinite(previous.longitude) && Math.abs(previous.longitude) <= 180
    ? { latitude: previous.latitude, longitude: previous.longitude } : null;
  if (city && !pin) {
    try { pin = await resolve(city); } catch { pin = null; }
  }
  return { locationCity: city, locationAccuracy: city ? "city" as const : null, latitude: pin?.latitude ?? null, longitude: pin?.longitude ?? null };
}
export function cityGeocodingResult(value: unknown, city: string): CityLocation | null {
  if (!Array.isArray(value)) return null;
  const matches = value.flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const result = item as Record<string, unknown>;
    if (typeof result.lat !== "string" || typeof result.lon !== "string" || !result.lat.trim() || !result.lon.trim()) return [];
    if (!["city", "town", "municipality", "administrative"].includes(String(result.addresstype))) return [];
    const name = typeof result.name === "string" ? result.name : typeof result.display_name === "string" ? result.display_name.split(",")[0] : "";
    if (normalizeCity(name) !== normalizeCity(city)) return [];
    const latitude = Number(result.lat), longitude = Number(result.lon);
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) return [];
    const address = result.address && typeof result.address === "object" ? result.address as Record<string, unknown> : {};
    const context = String(address.state ?? address.province ?? address.county ?? "").toLowerCase();
    return [{ latitude, longitude, context }];
  });
  // A city may have both a boundary and a centre node. Accept duplicates in the
  // same named region, but don't silently choose between ambiguous municipalities.
  if (!matches.length) return null;
  const contexts = new Set(matches.map(match => match.context));
  if (matches.length > 1 && (contexts.size !== 1 || !matches[0].context)) return null;
  return { latitude: matches[0].latitude, longitude: matches[0].longitude };
}
