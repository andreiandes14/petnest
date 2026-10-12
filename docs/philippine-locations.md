# Philippine city and municipality data

Source: https://github.com/Ordonia/listOfCityMunicipalityAndBarangay2025
Pinned revision: 75c2eefb6128b64515208f67d69a5afdc95fe90a
Input: barangay/data/barangay_extended.json (PSGC July 31, 2025 release).
Underlying classification: Philippine Statistics Authority PSGC.
License: MIT; notice preserved in shared/philippine-locations-LICENSE.txt.

The bundled snapshot contains 1643 cities and municipalities. Manila's submunicipalities are not separate municipalities. Independent cities have no administrative province; their region is shown instead. City names are displayed as Name City rather than City of Name. Only names, PSGC codes, province and region are retained; no coordinates are fabricated. Update this snapshot from a verified PSGC release when classifications change.

Suggestions and address matching run locally, without sending business addresses to an external lookup. Existing cached Photon/Nominatim city geocoding resolves selected city and province on profile save; availability is not guaranteed. Geocoding failure keeps the address and optional map-pin recovery.
