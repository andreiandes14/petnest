import { normalizeCity } from "./city-location.js";

export type AddressLocation = { latitude: number; longitude: number; accuracy: "building" | "street" | "area" | "city"; zoom: number };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const tokens = (value: string) => value.toLowerCase().replace(/\bhwy\b/g, "highway").replace(/\brd\b/g, "road").replace(/\bst\b/g, "street").replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/);
function mentioned(name: unknown, address: string) {
  if (typeof name !== "string" || !name.trim()) return false;
  const parts = tokens(name).filter(part => !["barangay", "brgy", "city"].includes(part));
  const query = new Set(tokens(address));
  return parts.length > 0 && parts.every(part => query.has(part));
}

/** Preserve the full address without adding the same city/province/country twice. */
export function addressSearchQuery(address: string, city: string, province?: string | null) {
  let query = address.trim().replace(/\b(?:brgy|bgy)\.?(?=\s|$)/gi, "Barangay").replace(/\s+/g, " ");
  // Providers often omit commas. Separate the selected locality suffix without
  // changing or discarding the house number, barangay or street they entered.
  if (!query.includes(",")) {
    for (const context of [normalizeCity(city), province]) {
      if (!context) continue;
      const index = query.toLowerCase().lastIndexOf(context.toLowerCase());
      if (index > 0) query = `${query.slice(0, index).trim()}, ${query.slice(index).trim()}`;
    }
  }
  for (const context of [normalizeCity(city), province, "Philippines"]) {
    if (context && !mentioned(context, query)) query += `, ${context}`;
  }
  return query;
}

export function addressSearchQueries(address: string, city: string, province?: string | null) {
  const full = addressSearchQuery(address, city, province);
  const barangay = full.match(/\bBarangay\s+([^,]+)/i)?.[1].trim();
  return [...new Set([full, ...(barangay ? [addressSearchQuery(`Barangay ${barangay}`, city, province)] : []), addressSearchQuery(city, city, province)])];
}

/** Reject country/city/province mismatches and classify only the address detail actually matched. */
export function classifyAddressFeatures(value: unknown, address: string, city: string, province?: string | null): AddressLocation | null {
  const features = object(value).features;
  if (!Array.isArray(features)) return null;
  const candidates = features.flatMap((feature: unknown) => {
    const item = object(feature), p = object(item.properties), geometry = object(item.geometry);
    const point = geometry.coordinates;
    if (String(p.countrycode).toLowerCase() !== "ph" || geometry.type !== "Point" || !Array.isArray(point) || point.length !== 2 ||
        typeof point[0] !== "number" || typeof point[1] !== "number" || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) return [];
    const isCity = ["city", "town", "municipality"].includes(String(p.osm_value));
    if (!(isCity ? [p.name] : [p.city]).some(part => typeof part === "string" && normalizeCity(part) === normalizeCity(city))) return [];
    if (province && ![p.state, p.county].some(part => typeof part === "string" && normalizeCity(part) === normalizeCity(province))) return [];
    let accuracy: AddressLocation["accuracy"];
    if (isCity) accuracy = "city";
    else if (mentioned(p.housenumber, address) && mentioned(p.street, address)) accuracy = "building";
    else if ((p.osm_key === "highway" && mentioned(p.name, address)) || mentioned(p.street, address)) accuracy = "street";
    else if (["suburb", "quarter", "neighbourhood", "village", "hamlet"].includes(String(p.osm_value)) && mentioned(p.name, address)) accuracy = "area";
    else if ([p.quarter, p.suburb, p.district].some(area => mentioned(area, address))) accuracy = "area";
    else if (["shop", "amenity", "building", "office", "tourism"].includes(String(p.osm_key)) && typeof p.name === "string" && normalizeCity(p.name) !== normalizeCity(city) && (!province || normalizeCity(p.name) !== normalizeCity(province)) && mentioned(p.name, address)) accuracy = "building";
    else return [];
    const zoom = { building: 18, street: 16, area: 14, city: 12 }[accuracy];
    return [{ latitude: point[1], longitude: point[0], accuracy, zoom }];
  });
  return candidates.sort((a, b) => b.zoom - a.zoom)[0] ?? null;
}

/** Nominatim JSONv2 uses strings for coordinates and OSM address component names. */
export function nominatimAddressResult(value: unknown, query: string, city: string, province?: string | null): AddressLocation | null {
  if (!Array.isArray(value)) return null;
  const features = value.flatMap(row => {
    const item = object(row), address = object(item.address);
    if (typeof item.lat !== "string" || !item.lat.trim() || typeof item.lon !== "string" || !item.lon.trim()) return [];
    const category = String(item.category ?? item.class ?? ""), type = String(item.addresstype ?? item.type ?? "");
    const name = typeof item.name === "string" ? item.name : typeof item.display_name === "string" ? item.display_name.split(",")[0].trim() : "";
    const cityType = ["city", "town", "municipality"].includes(type);
    return [{ geometry: { type: "Point", coordinates: [Number(item.lon), Number(item.lat)] }, properties: {
      name, countrycode: address.country_code, city: address.city ?? address.town ?? address.municipality,
      state: address.state, county: address.province ?? address.county ?? address.state_district,
      housenumber: address.house_number,
      street: address.road ?? address.pedestrian ?? address.residential ?? address.footway,
      quarter: address.quarter, suburb: address.suburb, district: address.neighbourhood ?? address.village,
      osm_key: cityType ? "place" : category === "highway" || type === "road" ? "highway" : category,
      osm_value: type,
    } }];
  });
  return classifyAddressFeatures({ features }, query, city, province);
}

