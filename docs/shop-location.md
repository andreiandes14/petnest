# Approximate business location

Providers enter their business address. Leaving the address field saves it through the existing authenticated provider-profile endpoint. Explicit city/municipality components such as `MUNTINLUPA CITY` are detected automatically. Ambiguous addresses show a City / Municipality field with suggestions and support for other names. City detection and address autosaving remain independent of optional shop pinpointing. There is no provider device geolocation or coordinate entry.

The API uses structured city searches against the existing server-side `GEOCODING_URL` (an HTTPS Nominatim-compatible search endpoint). Only city-level matching results are accepted. Ambiguous or invalid results remain unresolved. Successful results save `locationCity`, `locationAccuracy: city`, and approximate latitude/longitude. Client-supplied coordinates are ignored unless the explicit Save Location action supplies a valid selected pin and a matching current city. Changing the city clears the old coordinates; street-address changes in the same city reuse its saved city coordinates.

Address and profile saving still succeed if geocoding is unconfigured, busy, unavailable, or unmatched. Unresolved cities retry on a later explicit profile save. No scheduled or bulk geocoding runs. The API sends the city name, not the street address or customer coordinates, to the geocoder.

Public Nominatim (`https://nominatim.openstreetmap.org/search`) requires deliberate operator opt-in after reviewing https://operations.osmfoundation.org/policies/nominatim/. It permits moderate user-triggered use with a maximum of one request per second across the application. The implementation retains a shared MongoDB lease, a 1.2-second cooldown after requests, seven-day successful-city caching, a short unmatched-result cache, and an identifying User-Agent. Configure another compatible endpoint for larger requirements. There is no paid mapping dependency.

Directory ranking compares customer browser location to saved city locations. City-based distances are labelled `Approximately ? km to ?`; same-city providers may have equal distances. They are not exact shop distances or a guarantee of physical proximity. For unpinned providers, View Map searches the full business address instead of presenting a city centre as the exact shop. OpenStreetMap attribution appears with city-based results.

## Optional precise shop pin

The Leaflet/OpenStreetMap map centres on the saved geocoded city (`cityLatitude`, `cityLongitude`). The city centre is a viewport target, not a shop marker. Map clicks and marker dragging update an unsaved pin; **Save Location** persists the latest coordinates as `locationAccuracy: shop` for the authenticated provider. Reopening the profile restores the saved marker. Unrelated profile saves and changes within the same city retain the shop pin. A change to a different city discards the old pin and uses the newly resolved city location until a new pin is selected and saved.

City geocoding must succeed before the map can centre on that city. The map remains available for manual navigation if resolution fails. No city coordinates are hardcoded.

Map tiles use `https://tile.openstreetmap.org/{z}/{x}/{y}.png` by default, with visible attribution and normal browser caching. No bulk downloads or offline prefetching. Optional `VITE_MAP_TILE_URL` allows using another tile service (update attribution to match). Review https://operations.osmfoundation.org/policies/tiles/.

Nearby results place pinned shops first, ordered by Haversine straight-line distance to the saved pin, then city-only providers ordered by approximate city distance. City results never receive an exact-nearest-shop claim. View Map opens saved shop pins for pinned providers and otherwise searches their full business address. No customer coordinates are persisted.

## Map recovery and default geocoder

When `GEOCODING_URL` is unset, city resolution now uses the free Photon public API at `https://photon.komoot.io/api/`. Configured Nominatim endpoints still work; for a custom Photon instance set `GEOCODING_FORMAT=photon`. Photon permits reasonable project usage but may throttle or ban excessive requests and offers no availability guarantee: https://github.com/komoot/photon#demo-server. PetNest retains shared rate limiting and caching. Only city names are sent, never provider device/customer coordinates. Successful saved city centres from other providers are reused before another external lookup.

Opening a saved provider profile with an unresolved city automatically attempts resolution once. Failed resolution no longer hides Leaflet: the map explicitly shows a world overview (or restores a saved shop pin), never a guessed city. Providers can navigate and select a shop pin even without a geocoded centre. **Retry City Location** retries the saved address/city. City changes discard old-city centres, while a successful lookup recentres the existing map. Leaflet CSS is imported, map height is explicit, and resize events invalidate its size. Tile failures show a simple connection message.
