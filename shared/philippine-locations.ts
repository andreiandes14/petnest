import { philippineLocations } from "./philippine-locations-data.js";
import { normalizeCity } from "./city-location.js";
export type PhilippineLocation = typeof philippineLocations[number];
export { philippineLocations };
const key = (value: string) => normalizeCity(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function locationLabel(location: PhilippineLocation): string {
  return `${location.name}, ${location.province || location.region}`;
}
export function findPhilippineLocation(city: string, province?: string | null): PhilippineLocation | null {
  const exactLabel = philippineLocations.filter(item => key(locationLabel(item)) === key(city));
  if (exactLabel.length === 1) return exactLabel[0];
  const matches = philippineLocations.filter(item => key(item.name) === key(city) && (!province || key(item.province || item.region) === key(province)));
  return matches.length === 1 ? matches[0] : null;
}
export function detectPhilippineLocation(address: string): PhilippineLocation | null {
  const parts = address.split(/[,;\n]/).map(key).filter(Boolean);
  const candidates = philippineLocations.filter(item => parts.includes(key(item.name)));
  const qualified = candidates.filter(item => parts.includes(key(item.province || item.region)));
  const matches = qualified.length ? qualified : candidates;
  return matches.length === 1 ? matches[0] : null;
}
export function searchPhilippineLocations(query: string): PhilippineLocation[] {
  const words = key(query).split(/[ ,]+/).filter(Boolean);
  if (!words.length) return [];
  return philippineLocations.filter(item => words.every(word => key(locationLabel(item)).includes(word))).slice(0, 20);
}
