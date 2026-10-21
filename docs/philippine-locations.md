# Philippine city and municipality data

Source: https://github.com/Ordonia/listOfCityMunicipalityAndBarangay2025
Pinned revision: 75c2eefb6128b64515208f67d69a5afdc95fe90a
Input: barangay/data/barangay_extended.json (PSGC July 31, 2025 release).
Underlying classification: Philippine Statistics Authority PSGC.
License: MIT; notice preserved in shared/philippine-locations-LICENSE.txt.

The bundled snapshot contains 1643 cities and municipalities. Manila's submunicipalities are not separate municipalities. Independent cities have no administrative province; their region is shown instead. City names are displayed as Name City rather than City of Name. Only names, PSGC codes, province and region are retained; no coordinates are fabricated. Update this snapshot from a verified PSGC release when classifications change.

City suggestions and city-name matching run locally. Explicit address searches use the public Nominatim service as described below.

## Approximate city coordinates

All 1,643 city selections have bundled administrative centroids in `shared/philippine-city-coordinates.ts`. These are approximate city views, never exact shop pins. They keep the map and manual pin placement usable when geocoding is unavailable.

Source: [fish-and-bear/psgc](https://github.com/fish-and-bear/psgc/tree/e360c9da26ae9455f357ab7d048389a1a8f05c2a), pinned revision `e360c9da26ae9455f357ab7d048389a1a8f05c2a`, `psgc/data/core/cities.json`. Child-area-weighted centroids derive from PSA/NAMRIA boundaries via [OCHA HDX](https://data.humdata.org/dataset/cod-ab-phl). Source code is MIT; coordinate data is [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/). Notices are retained in `shared/philippine-city-coordinates-LICENSE.txt` and attribution appears by the map.

Reproduce the snapshot with `node scripts/update-city-coordinates.mjs`. It matches PSGC codes, then unambiguous city/province names, and fails if any option lacks source coordinates. Isabela's existing July-2025 grouping code `0990100000` is crosswalked to source city code `0990101000`. Review the pinned source before updating; do not fabricate missing coordinates.

## Free address search and manual shop pins

Business Location retains the address, city/province, Leaflet/OpenStreetMap map, draggable marker and Save Location. Search Address is explicit, not autocomplete. The server tries the complete address, barangay when present, then city/province. It validates country and locality, rejects unrelated results, and sets zoom according to building, street, area or city precision. Approximate results ask the provider to adjust the pin.

Manual pin edits cancel pending searches. Background profile refreshes preserve edits. Approximate results cannot replace saved exact pins; only explicit saving persists profile location changes. Saved shop pins restore and remain available to customer View Map and Nearby searches.

### Nominatim policy and configuration

Default endpoint: `https://nominatim.openstreetmap.org/search`. Optional server-side `ADDRESS_GEOCODING_URL` supports another Nominatim-compatible installation. No paid credentials are required.

Follow the [public usage policy](https://operations.osmfoundation.org/policies/nominatim/):

- No autocomplete, periodic scans or bulk searches; at most one upstream request per second application-wide.
- Provider-authenticated server requests share an atomic MongoDB lease with the city geocoder, with 1.2-second gaps and an identifying User-Agent.
- Cache complete lookup results for seven days, or one minute for city-only/empty results. Frontend rate-limit retries use backoff.
- Retain OpenStreetMap attribution. Do not submit confidential or personal addresses to the public service.
- Public coverage and availability are not guaranteed. Failed lookup leaves city fallback and manual placement usable; higher volume requires a suitable hosted or self-hosted service.
