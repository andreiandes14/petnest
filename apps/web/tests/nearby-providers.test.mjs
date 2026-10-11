import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../src/lib/nearby-providers.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { validCoordinates, distanceKm, nearbyProviders, nearbySearchMessage, requestBrowserLocation } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('coordinates must be numeric, finite, complete and within geographic bounds; zero is valid', () => {
  assert.equal(validCoordinates({ latitude: 0, longitude: 0 }), true);
  for (const value of [{}, { latitude: null, longitude: 0 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: '14', longitude: 120 }]) assert.equal(validCoordinates(value), false);
});
test('Haversine returns kilometers, symmetric distance and handles poles and antimeridian', () => {
  const origin = { latitude: 0, longitude: 0 };
  assert.equal(distanceKm(origin, origin), 0);
  assert.ok(Math.abs(distanceKm(origin, { latitude: 0, longitude: 1 }) - 111.1949) < 0.001);
  const a = { latitude: 14, longitude: 179.9 }, b = { latitude: 14, longitude: -179.9 };
  assert.equal(distanceKm(a, b), distanceKm(b, a));
  assert.ok(distanceKm(a, b) < 23);
  assert.ok(Number.isFinite(distanceKm({ latitude: 90, longitude: 0 }, { latitude: -90, longitude: 180 })));
});
test('ranking ignores ratings, excludes missing coordinates, breaks ties by ID and preserves source data', () => {
  const providers = [{ id: 9, latitude: 0, longitude: 2, rating: 5 }, { id: 4, latitude: 0, longitude: 1, rating: 1 }, { id: 3, latitude: 0, longitude: 1 }, { id: 1, rating: 5 }];
  const snapshot = structuredClone(providers);
  assert.deepEqual(nearbyProviders(providers, { latitude: 0, longitude: 0 }).map(item => item.provider.id), [3, 4, 9]);
  assert.deepEqual(providers, snapshot);
});

test('successful browser location starts a real distance ranking; no provider coordinates has an explicit result', async () => {
  const location = await requestBrowserLocation({ getCurrentPosition(success, failure, options) {
    assert.equal(options.enableHighAccuracy, true);
    assert.equal(options.timeout, 15000);
    success({ coords: { latitude: 0, longitude: 0 } });
  } }, true);
  assert.deepEqual(location, { latitude: 0, longitude: 0 });
  const ranked = nearbyProviders([{ id: 8, latitude: 0, longitude: 2 }, { id: 7, latitude: 0, longitude: 1 }], location);
  assert.equal(ranked[0].provider.id, 7);
  assert.ok(ranked[0].distance < ranked[1].distance);
  assert.equal(nearbySearchMessage([{ id: 1 }]), 'Your location was found, but nearby shops cannot be ranked yet because their shop locations have not been set.');
  assert.match(nearbySearchMessage([{ latitude: 0, longitude: 0 }]), /approximate city distances/);
});

test('browser permission denial, unavailable services, invalid locations and errors fail clearly', async () => {
  await assert.rejects(requestBrowserLocation({ getCurrentPosition(success, failure) { failure({ code: 1 }); } }, true), /Location access is needed to show nearby pet shops. You can still browse all providers./);
  for (const code of [2, 3]) await assert.rejects(requestBrowserLocation({ getCurrentPosition(success, failure) { failure({ code }); } }, true), /location is unavailable/);
  await assert.rejects(requestBrowserLocation(undefined, true), /location is unavailable/);
  await assert.rejects(requestBrowserLocation(undefined, false), /location is unavailable/);
  await assert.rejects(requestBrowserLocation({ getCurrentPosition(success) { success({ coords: { latitude: NaN, longitude: 0 } }); } }, true), /location is unavailable/);
  await assert.rejects(requestBrowserLocation({ getCurrentPosition() { throw new Error('private technical details'); } }, true), /location is unavailable/);
});

test('pinned shop ranking takes priority over approximate city centres; same-city distances can tie', () => {
  const providers = [{ id: 1, latitude: 0, longitude: 1, locationAccuracy: 'city' },
    { id: 2, latitude: 0, longitude: 2, locationAccuracy: 'shop' },
    { id: 3, latitude: 0, longitude: 3, locationAccuracy: 'shop' },
    { id: 4, latitude: 0, longitude: 1, locationAccuracy: 'city' }];
  const ranked = nearbyProviders(providers, { latitude: 0, longitude: 0 });
  assert.deepEqual(ranked.map(item => item.provider.id), [2, 3, 1, 4]);
  assert.equal(ranked[2].distance, ranked[3].distance);
});

test('View Map uses a saved shop pin but preserves address search for approximate city locations', async () => {
  const source = readFileSync(new URL('../src/lib/provider-location.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { providerMapUrl } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const exact = new URL(providerMapUrl('Business address', { latitude: 14.1, longitude: 121.1, locationAccuracy: 'shop' }));
  assert.equal(exact.searchParams.get('query'), '14.1,121.1');
  const approximate = new URL(providerMapUrl('Business address', { latitude: 14, longitude: 121, locationAccuracy: 'city' }));
  assert.equal(approximate.searchParams.get('query'), 'Business address');
});
