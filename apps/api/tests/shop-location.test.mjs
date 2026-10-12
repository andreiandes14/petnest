import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const cityModule = moduleUrl(readFileSync(new URL('../../../shared/city-location.ts', import.meta.url), 'utf8'));
const { detectCity, normalizeCity } = await import(cityModule);
const source = readFileSync(new URL('../src/lib/shop-location.ts', import.meta.url), 'utf8').replace('"../../../../shared/city-location.js"', JSON.stringify(cityModule));
const { cityGeocodingResult, photonCityResult, cityLocationUpdate, providerLocationUpdate } = await import(moduleUrl(source));

test('explicit city detection handles real address structure, case and municipalities', () => {
  assert.equal(detectCity('BLK 4 LT 14 CAMELLA HOMES 1, MUNTINLUPA CITY'), 'Muntinlupa City');
  assert.equal(detectCity('123 Street, City of Makati, Metro Manila'), 'City Of Makati');
  assert.equal(detectCity('Street, Municipality of San Pedro'), 'Municipality Of San Pedro');
  assert.equal(detectCity('City Heights Subdivision, Street'), null);
  assert.equal(detectCity('Makati City, Quezon City'), null);
  assert.equal(detectCity('Incomplete address'), null);
  assert.equal(normalizeCity('City Of Muntinlupa'), normalizeCity('Muntinlupa City'));
});
const match = (name, lat, lon, state = 'Metro Manila') => ({ name, lat, lon, addresstype: 'city', address: { state } });
test('city geocoding uses actual city result, rejects mismatches and invalid coordinates', () => {
  assert.deepEqual(cityGeocodingResult([match('Muntinlupa', '14.4', '121.1')], 'Muntinlupa City'), { latitude: 14.4, longitude: 121.1 });
  assert.equal(cityGeocodingResult([match('Makati', '14.4', '121.1')], 'Muntinlupa City'), null);
  assert.equal(cityGeocodingResult([match('Muntinlupa', '', '')], 'Muntinlupa City'), null);
  assert.equal(cityGeocodingResult([match('Muntinlupa', '91', '121')], 'Muntinlupa City'), null);
  assert.equal(cityGeocodingResult([{ ...match('Muntinlupa', '14', '121'), addresstype: 'shop' }], 'Muntinlupa City'), null);
  assert.equal(cityGeocodingResult([], 'Muntinlupa City'), null);
});
test('duplicate city boundaries and centres can resolve; distinct regions remain ambiguous', () => {
  assert.deepEqual(cityGeocodingResult([match('Muntinlupa', '14.4', '121.1'), match('Muntinlupa', '14.41', '121.11')], 'Muntinlupa City'), { latitude: 14.4, longitude: 121.1 });
  assert.equal(cityGeocodingResult([match('San Jose', '14', '121', 'Province A'), match('San Jose', '15', '122', 'Province B')], 'San Jose'), null);
});

test('city changes clear stale coordinates, resolver failures stay pending and later saves retry', async () => {
  const old = { locationCity: 'Muntinlupa City', locationAccuracy: 'city', latitude: 14, longitude: 121 };
  let called = 0;
  const resolve = async () => { called++; return { latitude: 15, longitude: 122 }; };
  assert.deepEqual(await cityLocationUpdate(old, 'City of Muntinlupa', resolve), { locationCity: 'City of Muntinlupa', locationAccuracy: 'city', latitude: 14, longitude: 121 });
  assert.equal(called, 0);
  assert.deepEqual(await cityLocationUpdate(old, 'Makati City', resolve), { locationCity: 'Makati City', locationAccuracy: 'city', latitude: 15, longitude: 122 });
  const pending = await cityLocationUpdate(old, 'Makati City', async () => { throw new Error('service offline'); });
  assert.deepEqual(pending, { locationCity: 'Makati City', locationAccuracy: 'city', latitude: null, longitude: null });
  assert.deepEqual(await cityLocationUpdate(pending, 'Makati City', resolve), { locationCity: 'Makati City', locationAccuracy: 'city', latitude: 15, longitude: 122 });
  assert.deepEqual(await cityLocationUpdate(old, null, resolve), { locationCity: null, locationAccuracy: null, latitude: null, longitude: null });
});

test('optional pin persists independently of city centre; city change invalidates the old shop pin', async () => {
  const resolve = async city => city === 'Makati City' ? { latitude: 15, longitude: 122 } : { latitude: 14, longitude: 121 };
  const approximate = await providerLocationUpdate({}, 'Muntinlupa City', resolve);
  assert.equal(approximate.locationAccuracy, 'city');
  assert.equal(approximate.cityLatitude, 14);
  const pinned = await providerLocationUpdate(approximate, 'Muntinlupa City', resolve, { latitude: 14.01, longitude: 121.02 });
  assert.equal(pinned.locationAccuracy, 'shop');
  assert.equal(pinned.latitude, 14.01);
  assert.equal(pinned.cityLatitude, 14);
  assert.deepEqual(await providerLocationUpdate(pinned, 'Muntinlupa City', resolve), pinned);
  const moved = await providerLocationUpdate(pinned, 'Makati City', resolve);
  assert.equal(moved.locationAccuracy, 'city');
  assert.equal(moved.latitude, 15);
  const latest = await providerLocationUpdate(pinned, 'Muntinlupa City', resolve, { latitude: 14.03, longitude: 121.04 });
  assert.equal(latest.latitude, 14.03);
  assert.equal(latest.longitude, 121.04);
  await assert.rejects(providerLocationUpdate(pinned, null, resolve, { latitude: 14, longitude: 121 }));
  await assert.rejects(providerLocationUpdate(pinned, 'Muntinlupa City', resolve, { latitude: 91, longitude: 121 }));
});

const feature = (name, type, state, longitude, latitude) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [longitude, latitude] }, properties: { name, osm_value: type, countrycode: 'PH', state } });
test('Photon resolves Muntinlupa and Santa Rosa City without selecting another same-name town', () => {
  const muntinlupa = { features: [feature('Muntinlupa', 'city', 'Metro Manila', 121.03, 14.41)] };
  assert.deepEqual(photonCityResult(muntinlupa, 'Muntinlupa City'), { latitude: 14.41, longitude: 121.03 });
  const rosa = { features: [feature('Santa Rosa', 'city', 'Laguna', 121.1, 14.3), feature('Santa Rosa', 'town', 'Nueva Ecija', 120.9, 15.4)] };
  assert.deepEqual(photonCityResult(rosa, 'Santa Rosa City'), { latitude: 14.3, longitude: 121.1 });
  assert.equal(photonCityResult(rosa, 'Santa Rosa'), null);
  assert.equal(photonCityResult({ features: [feature('Other City', 'city', 'Laguna', 121, 14)] }, 'Santa Rosa City'), null);
  assert.equal(photonCityResult({ features: [] }, 'Muntinlupa City'), null);
});

const dataModule = moduleUrl(readFileSync(new URL('../../../shared/philippine-locations-data.ts', import.meta.url), 'utf8'));
const nationalSource = readFileSync(new URL('../../../shared/philippine-locations.ts', import.meta.url), 'utf8')
  .replace('"./philippine-locations-data.js"', JSON.stringify(dataModule))
  .replace('"./city-location.js"', JSON.stringify(cityModule));
const { philippineLocations, detectPhilippineLocation, findPhilippineLocation, searchPhilippineLocations, locationLabel } = await import(moduleUrl(nationalSource));
test('nationwide PSGC data detects Calamba with province and rejects ambiguous bare names', () => {
  assert.equal(philippineLocations.length, 1643);
  assert.equal(new Set(philippineLocations.map(item => item.code)).size, 1643);
  assert.equal(new Set(philippineLocations.map(item => item.region)).size, 18);
  const calamba = detectPhilippineLocation('Buenavista Executive Homes, Calamba, Laguna');
  assert.equal(calamba.name, 'Calamba City');
  assert.equal(calamba.province, 'Laguna');
  assert.equal(locationLabel(calamba), 'Calamba City, Laguna');
  assert.equal(detectPhilippineLocation('Subdivision, Calamba'), null);
  assert.equal(detectPhilippineLocation('Calamba Homes, Laguna'), null);
  assert.equal(findPhilippineLocation('Calamba', 'Misamis Occidental').name, 'Calamba');
  assert.equal(findPhilippineLocation('Calamba City, Laguna').code, calamba.code);
});
test('search supports provinces, regions and independent cities nationwide', () => {
  assert.equal(searchPhilippineLocations('Calamba').length, 2);
  for (const query of ['Cavite', 'Batangas', 'Rizal', 'Bulacan', 'Cebu', 'Davao']) assert.ok(searchPhilippineLocations(query).length);
  assert.equal(detectPhilippineLocation('Camella, Muntinlupa City').name, 'Muntinlupa City');
  assert.equal(findPhilippineLocation('Cebu City').province, null);
  assert.equal(searchPhilippineLocations('').length, 0);
  assert.equal(findPhilippineLocation('Invented City'), null);
  assert.ok(searchPhilippineLocations('San').length <= 20);
});
test('province-qualified geocoding excludes same-name places in other provinces', () => {
  const result = [match('Calamba', '14.2', '121.1', 'Laguna'), match('Calamba', '8.5', '123.6', 'Misamis Occidental')];
  assert.deepEqual(cityGeocodingResult(result, 'Calamba City', 'Laguna'), { latitude: 14.2, longitude: 121.1 });
  assert.equal(cityGeocodingResult(result, 'Calamba City', 'Cavite'), null);
  assert.deepEqual(photonCityResult({ features: [{ properties: { name: 'Calamba', osm_value: 'city', countrycode: 'PH', state: 'Laguna' }, geometry: { type: 'Point', coordinates: [121.1, 14.2] } }] }, 'Calamba City', 'Laguna'), { latitude: 14.2, longitude: 121.1 });
});
