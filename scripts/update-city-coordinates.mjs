// Run from the repository root after reviewing a new upstream revision.
import { readFileSync, writeFileSync } from 'node:fs';
const revision = 'e360c9da26ae9455f357ab7d048389a1a8f05c2a';
const base = `https://raw.githubusercontent.com/fish-and-bear/psgc/${revision}/`;
async function download(path) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error(`Coordinate source request failed: ${response.status}`);
  return response;
}
const cities = await (await download('psgc/data/core/cities.json')).json();
const provinces = await (await download('psgc/data/core/provinces.json')).json();
const license = await (await download('LICENSE')).text();
const raw = readFileSync('shared/philippine-locations-data.ts', 'utf8');
const locations = JSON.parse(raw.slice(raw.indexOf('= ') + 2, raw.lastIndexOf(';')));
const normalized = value => value.toLowerCase().replace(/^city of /, '').replace(/ city$/, '').trim();
const provinceNames = new Map(provinces.map(place => [place.psgc_code, place.name]));
// The existing July-2025 snapshot uses Isabela's independent-city parent code.
const crosswalk = { '0990100000': '0990101000' };
const coordinates = {};
for (const place of locations) {
  let source = cities.find(city => city.psgc_code === (crosswalk[place.code] ?? place.code));
  if (!source) {
    const matches = cities.filter(city => normalized(city.name) === normalized(place.name) && place.province && normalized(provinceNames.get(city.province_code) ?? '') === normalized(place.province));
    if (matches.length === 1) source = matches[0];
  }
  const point = source?.coordinate;
  if (!point || source.coordinate_source !== 'child_area_weighted_centroid' || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) throw new Error(`No verified city centroid for ${place.code} ${place.name}`);
  coordinates[place.code] = { latitude: point.latitude, longitude: point.longitude };
}
writeFileSync('shared/philippine-city-coordinates.ts', `// Approximate administrative centroids; never exact shop pins.\n// Source: fish-and-bear/psgc @ ${revision} (PSA/NAMRIA/HDX); see docs/philippine-locations.md.\nexport const philippineCityCoordinates: Record<string, { latitude: number; longitude: number }> = ${JSON.stringify(coordinates)};\n`);
writeFileSync('shared/philippine-city-coordinates-LICENSE.txt', `${license}\nCoordinate data: OCHA HDX Philippines Subnational Administrative Boundaries, PSA/NAMRIA. CC BY 3.0 IGO: https://creativecommons.org/licenses/by/3.0/igo/\nDerived from child-area-weighted administrative centroids; source https://github.com/fish-and-bear/psgc\n`);
console.log(`Bundled ${Object.keys(coordinates).length} city/municipality centroids.`);
