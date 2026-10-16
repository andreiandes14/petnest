import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync(new URL('../src/routes/petnest.ts', import.meta.url), 'utf8');
const compile = s => ts.transpileModule(s, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(category = 'grooming') {
  const provider = { id: 10, name: 'Shop', categories: ['grooming', 'vaccination'], services: [
    { id: 1, name: 'Service', category, available: true, price: 1000, durationMinutes: 60 },
    { id: 2, name: 'Temporarily unavailable', category, available: false, price: 500 },
  ] };
  const handlers = new Map(); let providerId = 10, authenticated = true, failPersistence = false;
  const deps = { router: { delete(path, fn) { handlers.set('delete:' + path, fn); }, get(path, fn) { handlers.set('get:' + path, fn); }, patch(path, fn) { handlers.set('patch:' + path, fn); } },
    requireProvider: async (req, res) => { if (!authenticated) { res.status(401).json({ error: 'Unauthorized' }); return null; } return { providerId }; },
    providerCollection: {
      async findOne(filter) { return (filter.id === undefined || filter.id === provider.id) && (filter['services.id'] === undefined || provider.services.some(s => s.id === filter['services.id'])) ? structuredClone(provider) : null; },
      async updateOne(filter, update) {
        if (failPersistence) return { matchedCount: 1, modifiedCount: 0 };
        const service = provider.services.find(s => s.id === filter['services.id']);
        if (!service) return { matchedCount: 0, modifiedCount: 0 };
        for (const [key, value] of Object.entries(update.$set)) { if (key.startsWith('services.$.')) service[key.slice('services.$.'.length)] = value; }
        return { matchedCount: 1, modifiedCount: 1 };
      },
    }, GetProviderResponse: { parse: p => p }, validText: value => typeof value === 'string' && !!value.trim(),
  };
  const install = (begin, end) => new Function(...Object.keys(deps), compile(source.slice(source.indexOf(begin), source.indexOf(end, source.indexOf(begin) + 1))))(...Object.values(deps));
  install('router.delete("/provider/services/:serviceId"', 'router.post("/provider/products"');
  install('router.get("/provider/profile"', 'router.patch("/provider/password"');
  install('router.get("/services/:serviceId"', 'router.get("/provider/profile"');
  install('router.patch("/provider/services/:serviceId"', 'router.delete("/provider/services/:serviceId"');
  return { provider, fail() { failPersistence = true; }, otherProvider() { providerId = 20; }, signOut() { authenticated = false; }, async call(path = 'delete:/provider/services/:serviceId', id = '1') {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handlers.get(path)({ params: { serviceId: id }, body: {} }, res); return res;
  } };
}
for (const category of ['grooming', 'vaccination']) test(`${category}: persisted removal disappears from refreshed profile and customer lookup while retaining historical service data`, async () => {
  const f = fixture(category); const original = structuredClone(f.provider.services[0]);
  const response = await f.call(); assert.equal(response.code, 200); assert.deepEqual(response.body, { removed: true, serviceId: 1 });
  const saved = f.provider.services[0]; assert.equal(saved.available, false); assert.ok(saved.removedAt);
  assert.equal(saved.name, original.name); assert.equal(saved.price, original.price); assert.equal(saved.durationMinutes, original.durationMinutes);
  const profile = await f.call('get:/provider/profile'); assert.deepEqual(profile.body.services.map(s => s.id), [2]);
  assert.equal((await f.call('get:/services/:serviceId')).code, 404);
  assert.equal((await f.call('patch:/provider/services/:serviceId')).code, 409);
  assert.equal(f.provider.services.length, 2); // Soft removal keeps service references intact.
});
test('failed persistence, wrong provider, invalid ID and unauthenticated requests never report successful removal', async () => {
  const f = fixture(); f.fail(); assert.equal((await f.call()).code, 503); assert.equal(f.provider.services[0].available, true);
  assert.equal((await f.call('delete:/provider/services/:serviceId', 'invalid')).code, 400);
  f.otherProvider(); assert.equal((await f.call()).code, 404);
  f.signOut(); assert.equal((await f.call()).code, 401);
});
