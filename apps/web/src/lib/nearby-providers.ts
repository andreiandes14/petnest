export type Coordinates = { latitude: number; longitude: number };
export function nearbySearchMessage(providers: { latitude?: number | null; longitude?: number | null }[]) {
  return providers.some(validCoordinates)
    ? "Your location was found. Pinned shops are ordered by distance first; other providers use approximate city distances."
    : "Your location was found, but nearby shops cannot be ranked yet because their shop locations have not been set.";
}
export function requestBrowserLocation(geolocation: Pick<Geolocation, "getCurrentPosition"> | undefined, secure: boolean): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    const unavailable = "Your location is unavailable. Please try again. You can still browse all providers.";
    if (!secure || !geolocation) { reject(new Error(unavailable)); return; }
    try {
      geolocation.getCurrentPosition(position => {
        const coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        if (validCoordinates(coordinates)) resolve(coordinates);
        else reject(new Error(unavailable));
      }, error => reject(new Error(error.code === 1
        ? "Location access is needed to show nearby pet shops. You can still browse all providers."
        : unavailable)), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch { reject(new Error(unavailable)); }
  });
}
export function validCoordinates(value: { latitude?: number | null; longitude?: number | null }): value is Coordinates {
  return typeof value.latitude === "number" && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === "number" && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
export function distanceKm(a: Coordinates, b: Coordinates) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const h = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function nearbyProviders<T extends { id: number; latitude?: number | null; longitude?: number | null; locationAccuracy?: string | null }>(providers: T[], origin: Coordinates) {
  return providers.filter((provider): provider is T & Coordinates => validCoordinates(provider)).map(provider => ({ provider, distance: distanceKm(origin, provider) }))
    .sort((a, b) => Number(b.provider.locationAccuracy === "shop") - Number(a.provider.locationAccuracy === "shop") || a.distance - b.distance || a.provider.id - b.provider.id);
}
